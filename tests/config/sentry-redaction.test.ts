import type { Breadcrumb, ErrorEvent, Event } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from "@/lib/log-redaction";

type TransactionEvent = Event & { type: "transaction" };

describe("Sentry Telemetry Redaction (Task 13)", () => {
  it("removes request body data completely in beforeSend", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "test-event-1",
      request: {
        url: "https://example.com/api/online/orders",
        method: "POST",
        data: JSON.stringify({
          contactName: "Khách Hàng",
          contactPhone: "0901234567",
          password: "plain-password",
        }),
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.request?.data).toBeUndefined();
  });

  it("strips cookies and all but allowlisted request headers (WEB-6)", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "test-event-2",
      request: {
        url: "https://example.com/api/online/orders",
        headers: {
          authorization: "Bearer secret-token-123",
          cookie: "customer_session=abc; checkout_recovery=xyz",
          "x-forwarded-for": "203.0.113.195",
          referer: "https://example.com/orders/guest/cap-token?ref=mail",
          "User-Agent": "Mozilla/5.0",
          "content-type": "application/json",
        },
        cookies: {
          customer_session: "abc",
          checkout_recovery: "xyz",
        },
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized?.request?.cookies).toBeUndefined();
    expect(sanitized?.request?.headers).toEqual({
      "User-Agent": "Mozilla/5.0",
      "content-type": "application/json",
    });
  });

  it("strips the query string from the request (WEB-6)", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "test-event-qs",
      request: {
        url: "https://shop.example.com/api/orders/lookup?phone=0901234567&email=a%40b.vn#top",
        query_string: "phone=0901234567&email=a%40b.vn",
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized?.request?.query_string).toBeUndefined();
    expect(sanitized?.request?.url).toBe(
      "https://shop.example.com/api/orders/lookup",
    );
  });

  it("normalizes guest capability URLs and receipt URLs in event request and breadcrumbs", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "test-event-3",
      request: {
        url: "https://shop.example.com/orders/guest/very-secret-capability-token-12345",
      },
      breadcrumbs: [
        {
          type: "http",
          category: "xhr",
          data: {
            url: "https://shop.example.com/order-success/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            method: "GET",
          },
        },
      ],
    };

    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized?.request?.url).toBe(
      "https://shop.example.com/orders/guest/[REDACTED]",
    );
    expect(sanitized?.breadcrumbs?.[0]?.data?.url).toBe(
      "https://shop.example.com/order-success/[REDACTED]",
    );
  });

  it("sanitizes user PII fields (ip, phone, email)", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "test-event-4",
      user: {
        id: "user-123",
        ip_address: "203.0.113.195",
        email: "user@example.com",
        username: "0901234567",
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized?.user?.ip_address).toBe("[REDACTED]");
    expect(sanitized?.user?.email).toBe("[REDACTED]");
    expect(sanitized?.user?.username).toBe("[REDACTED]");
    expect(sanitized?.user?.id).toBe("user-123");
  });

  it("sanitizes sensitive keys in breadcrumbs", () => {
    const breadcrumb: Breadcrumb = {
      category: "ui.click",
      data: {
        button: "submit",
        contactPhone: "0901234567",
        token: "secret-token",
        address: "123 Private Street",
      },
    };

    const sanitized = sanitizeSentryBreadcrumb(breadcrumb);
    expect(sanitized?.data?.button).toBe("submit");
    expect(sanitized?.data?.contactPhone).toBe("[REDACTED]");
    expect(sanitized?.data?.token).toBe("[REDACTED]");
    expect(sanitized?.data?.address).toBe("[REDACTED]");
  });
});

describe("sanitizeSentryTransaction (WEB-6)", () => {
  function transaction(): TransactionEvent {
    return {
      type: "transaction",
      event_id: "test-transaction-1",
      transaction:
        "GET /orders/guest/very-secret-capability-token-12345?email=a%40b.vn",
      request: {
        url: "https://shop.example.com/orders/guest/very-secret-capability-token-12345?email=a%40b.vn",
        query_string: { email: "a@b.vn" },
        headers: { cookie: "customer_session=abc", "user-agent": "UA" },
        cookies: { customer_session: "abc" },
        data: { contactPhone: "0901234567" },
      },
      user: { id: "u1", ip_address: "203.0.113.195", email: "a@b.vn" },
      extra: { customerName: "Nguyễn Văn A" },
      contexts: {
        trace: {
          trace_id: "t1",
          span_id: "root",
          data: {
            "url.query": "phone=0901234567",
            "http.target": "/api/orders/lookup?phone=0901234567",
            "http.request.header.cookie": "customer_session=abc",
            "http.request.header.x_forwarded_for": "203.0.113.195",
            "http.request.header.user_agent": "UA",
            "http.route": "/api/orders/lookup",
          },
        },
      },
      spans: [
        {
          span_id: "s1",
          trace_id: "t1",
          start_timestamp: 0,
          description:
            "GET https://shop.example.com/order-success/0123456789abcdef0123456789abcdef",
          data: {
            "http.query": "?phone=0901234567",
            "url.query": "phone=0901234567",
            "http.url": "https://shop.example.com/api/x?phone=0901234567",
            "url.full": "https://shop.example.com/api/x?phone=0901234567",
            "http.target": "/api/x?phone=0901234567",
            "http.method": "GET",
          },
        },
        {
          span_id: "s2",
          trace_id: "t1",
          start_timestamp: 0,
          description: "SELECT * FROM `Order` WHERE `id` = ?",
          data: { "db.system": "sqlite" },
        },
      ],
    };
  }

  it("strips request query, cookies, headers and body", () => {
    const request = sanitizeSentryTransaction(transaction())?.request;

    expect(request?.query_string).toBeUndefined();
    expect(request?.cookies).toBeUndefined();
    expect(request?.data).toBeUndefined();
    expect(request?.headers).toEqual({ "user-agent": "UA" });
    expect(request?.url).toBe(
      "https://shop.example.com/orders/guest/[REDACTED]",
    );
  });

  it("redacts the transaction name, user and extra", () => {
    const sanitized = sanitizeSentryTransaction(transaction());

    expect(sanitized?.transaction).toBe("GET /orders/guest/[REDACTED]");
    expect(sanitized?.user).toEqual({
      id: "u1",
      ip_address: "[REDACTED]",
      email: "[REDACTED]",
    });
    expect(sanitized?.extra?.customerName).toBe("[REDACTED]");
  });

  it("strips query data from span attributes but keeps SQL placeholders", () => {
    const [http, db] = sanitizeSentryTransaction(transaction())?.spans ?? [];

    expect(http?.description).toBe(
      "GET https://shop.example.com/order-success/[REDACTED]",
    );
    expect(http?.data).toEqual({
      "http.url": "https://shop.example.com/api/x",
      "url.full": "https://shop.example.com/api/x",
      "http.target": "/api/x",
      "http.method": "GET",
    });
    expect(db?.description).toBe("SELECT * FROM `Order` WHERE `id` = ?");
  });

  it("strips query and non-allowlisted headers from the root span", () => {
    const sanitized = sanitizeSentryTransaction(transaction());

    expect(sanitized?.contexts?.trace?.data).toEqual({
      "http.target": "/api/orders/lookup",
      "http.request.header.user_agent": "UA",
      "http.route": "/api/orders/lookup",
    });
  });
});

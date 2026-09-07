import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from "@/lib/log-redaction";

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

  it("redacts cookies and authorization headers from request headers", () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: "test-event-2",
      request: {
        url: "https://example.com/api/online/orders",
        headers: {
          authorization: "Bearer secret-token-123",
          cookie: "customer_session=abc; checkout_recovery=xyz",
          "user-agent": "Mozilla/5.0",
        },
        cookies: {
          customer_session: "abc",
          checkout_recovery: "xyz",
        },
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    expect(sanitized?.request?.headers?.authorization).toBe("[REDACTED]");
    expect(sanitized?.request?.headers?.cookie).toBe("[REDACTED]");
    expect(sanitized?.request?.cookies?.customer_session).toBe("[REDACTED]");
    expect(sanitized?.request?.cookies?.checkout_recovery).toBe("[REDACTED]");
    expect(sanitized?.request?.headers?.["user-agent"]).toBe("Mozilla/5.0");
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

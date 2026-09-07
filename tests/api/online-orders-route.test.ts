import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/online/orders/route";
import * as createOnlineOrderModule from "@/server/orders/create-online-order";
import { setCheckoutAbuseLimiter } from "@/server/security/checkout-abuse";
import type { RateLimiter } from "@/server/security/rate-limit";
import { OnlineOrderError } from "@/types/online-order";

const fakePassLimiter: RateLimiter = {
  async check() {
    return {
      allowed: true as const,
      remaining: 10,
      limit: 10,
      resetInSeconds: 60,
    };
  },
};

describe("POST /api/online/orders (Task 4 & Task 5: Hard limits and Anti-Abuse)", () => {
  beforeEach(() => {
    setCheckoutAbuseLimiter(fakePassLimiter);
  });

  afterEach(() => {
    setCheckoutAbuseLimiter(null);
  });

  it("rejects oversized declared Content-Length with 413 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "65000",
      },
      body: JSON.stringify({ items: [] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects chunked stream crossing 64 KB with 413 without running business logic", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const chunk1 = new Uint8Array(40_000).fill(65);
    const chunk2 = new Uint8Array(30_000).fill(66);
    let chunkIndex = 0;
    const chunks = [chunk1, chunk2];

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(chunks[chunkIndex++]);
        } else {
          controller.close();
        }
      },
    });

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: stream,
      // @ts-expect-error duplex
      duplex: "half",
    });

    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content-type with 415 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "plain text",
    });

    const response = await POST(req);
    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{ not valid json }",
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid schema with 400 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ invalidField: "test" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects requests exceeding IP/subnet rate limits with 429 and Retry-After", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const blockingLimiter: RateLimiter = {
      async check() {
        return {
          allowed: false as const,
          reason: "rate_limited" as const,
          retryAfterSeconds: 45,
          limit: 10,
          remaining: 0 as const,
        };
      },
    };
    setCheckoutAbuseLimiter(blockingLimiter);

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ clientId: "test", customer: {}, items: [] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("retry-after")).toBe("45");
    expect(createSpy).not.toHaveBeenCalled();
  });

  describe("Task 11: Concurrent Idempotency & Guest Recovery HTTP boundary", () => {
    const samplePayload = {
      clientId: "c45b85a6-9818-4a57-8d07-28d8b9d316e6",
      lines: [{ productId: "prod-1", quantity: 1 }],
      contactName: "Khách Hàng A",
      contactPhone: "0901234567",
      fulfillmentType: "pickup",
      paymentMethod: "cod",
    };

    it("issues checkout_recovery cookie on first guest checkout and returns accessUrl", async () => {
      vi.spyOn(
        createOnlineOrderModule,
        "createOnlineOrder",
      ).mockResolvedValueOnce({
        order: {
          id: "order-1",
          code: "DH0001",
          subtotal: 100_000,
          discount: 0,
          total: 100_000,
          status: "pending",
          hasStockWarning: false,
        },
        duplicated: false,
      });

      const req = new Request("https://example.com/api/online/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("checkout_recovery=");
      expect(setCookie).toContain("HttpOnly");

      const body = await response.json();
      expect(body.data.duplicated).toBe(false);
      expect(body.data.order.accessUrl).toMatch(/^\/orders\/guest\//);
    });

    it("recovers guest accessUrl when retried with the matching checkout_recovery cookie", async () => {
      vi.spyOn(
        createOnlineOrderModule,
        "createOnlineOrder",
      ).mockResolvedValueOnce({
        order: {
          id: "order-1",
          code: "DH0001",
          subtotal: 100_000,
          discount: 0,
          total: 100_000,
          status: "pending",
          hasStockWarning: false,
        },
        duplicated: true,
        recoveredGuestToken: "recovered-guest-token-123",
      });

      const req = new Request("https://example.com/api/online/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "checkout_recovery=some-recovery-secret",
        },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.duplicated).toBe(true);
      expect(body.data.order.accessUrl).toBe(
        "/orders/guest/recovered-guest-token-123",
      );
    });

    it("omits guest accessUrl when retried without matching cookie", async () => {
      vi.spyOn(
        createOnlineOrderModule,
        "createOnlineOrder",
      ).mockResolvedValueOnce({
        order: {
          id: "order-1",
          code: "DH0001",
          subtotal: 100_000,
          discount: 0,
          total: 100_000,
          status: "pending",
          hasStockWarning: false,
        },
        duplicated: true,
        recoveredGuestToken: undefined,
      });

      const req = new Request("https://example.com/api/online/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.data.duplicated).toBe(true);
      expect(body.data.order.accessUrl).toBeUndefined();
    });

    it("returns 409 Conflict when OnlineOrderError with IDEMPOTENCY_CONFLICT is thrown", async () => {
      vi.spyOn(
        createOnlineOrderModule,
        "createOnlineOrder",
      ).mockRejectedValueOnce(
        new OnlineOrderError(
          "IDEMPOTENCY_CONFLICT",
          "Mã giao dịch đã được sử dụng cho đơn hàng khác",
        ),
      );

      const req = new Request("https://example.com/api/online/orders", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.code).toBe("IDEMPOTENCY_CONFLICT");
    });
  });
});

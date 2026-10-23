import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/online/orders/route";
import * as createOnlineOrderModule from "@/server/orders/create-online-order";
import { OrderValidationError } from "@/server/orders/order-validation-error";
import { setCheckoutAbuseLimiter } from "@/server/security/checkout-abuse";
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";
import { setVoucherRateLimiter } from "@/server/vouchers/voucher-rate-limit";
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
    vi.restoreAllMocks();
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

    it("returns non-enumerable receiptUrl with 256-bit nonce and not sequential code", async () => {
      const mockNonce =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
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
        receiptNonce: mockNonce,
      });

      const req = new Request("https://example.com/api/online/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.order.receiptUrl).toBe(`/order-success/${mockNonce}`);
      expect(body.data.order.receiptUrl).not.toContain("DH0001");
    });

    it("treats a malformed customer_session cookie as a guest instead of failing (AUTH-11)", async () => {
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
        headers: {
          "content-type": "application/json",
          cookie: "customer_session=%E0",
        },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.data.order.accessUrl).toMatch(/^\/orders\/guest\//);
    });

    it("replaces a malformed checkout_recovery cookie with a fresh secret (AUTH-11)", async () => {
      const createSpy = vi
        .spyOn(createOnlineOrderModule, "createOnlineOrder")
        .mockResolvedValueOnce({
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
        headers: {
          "content-type": "application/json",
          cookie: "checkout_recovery=%E0",
        },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(201);
      expect(response.headers.get("set-cookie")).toContain(
        "checkout_recovery=",
      );
      const secret = createSpy.mock.calls[0]?.[1]?.guestRecovery?.secret;
      expect(secret).toBeTruthy();
      expect(secret).not.toBe("%E0");
    });

    it("logs only the error class and code for unexpected failures (WEB-6)", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      vi.spyOn(
        createOnlineOrderModule,
        "createOnlineOrder",
      ).mockRejectedValueOnce(
        Object.assign(
          new Error("Unique constraint failed: phone 0901234567, Khách Hàng A"),
          { code: "P2002" },
        ),
      );

      const req = new Request("https://example.com/api/online/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(samplePayload),
      });

      const response = await POST(req);
      expect(response.status).toBe(500);

      const logged = consoleErrorSpy.mock.calls[0]?.[0] as {
        message: string;
        meta: Record<string, unknown>;
      };
      consoleErrorSpy.mockRestore();
      expect(logged.message).toBe("online_order_create_failed");
      expect(Object.keys(logged.meta).sort()).toEqual([
        "correlationId",
        "errorClass",
        "errorCode",
      ]);
      expect(logged.meta).toMatchObject({
        errorClass: "Error",
        errorCode: "P2002",
      });
      expect(JSON.stringify(logged)).not.toContain("0901234567");
    });
  });

  describe("BL-1: stock hoarding limits at the HTTP boundary", () => {
    const payload = {
      lines: [{ productId: "prod-1", quantity: 1 }],
      contactName: "Khách Hàng A",
      contactPhone: "0901234567",
      fulfillmentType: "pickup",
      paymentMethod: "cod",
    };

    function post(body: Record<string, unknown>) {
      return POST(
        new Request("https://example.com/api/online/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    }

    it("rejects more than 50 units of a line with a Vietnamese 400 message", async () => {
      const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

      const response = await post({
        ...payload,
        clientId: "1b0f1f0e-6a51-4d8c-9a55-3f1f5f4a0c01",
        lines: [{ productId: "prod-1", quantity: 51 }],
      });

      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toContain("no-store");
      const body = await response.json();
      expect(body.message).toBe(
        "Mỗi sản phẩm chỉ được đặt tối đa 50 trong một đơn",
      );
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("counts the 0xxx and +84xxx forms of a phone in one rate-limit bucket", async () => {
      const phoneKeys: string[] = [];
      setCheckoutAbuseLimiter({
        async check(_policy, buckets) {
          for (const bucket of buckets) {
            if (bucket.dimension === "phone") phoneKeys.push(bucket.identifier);
          }
          return {
            allowed: true as const,
            remaining: 10,
            limit: 10,
            resetInSeconds: 60,
          };
        },
      });
      vi.spyOn(createOnlineOrderModule, "createOnlineOrder").mockResolvedValue({
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

      await post({
        ...payload,
        clientId: "1b0f1f0e-6a51-4d8c-9a55-3f1f5f4a0c02",
        contactPhone: "0901234567",
      });
      await post({
        ...payload,
        clientId: "1b0f1f0e-6a51-4d8c-9a55-3f1f5f4a0c03",
        contactPhone: "+84901234567",
      });

      expect(phoneKeys).toEqual(["+84901234567", "+84901234567"]);
    });
  });

  describe("WB-6: error responses are never cached", () => {
    it.each([
      [
        "OnlineOrderError 409",
        new OnlineOrderError(
          "TOO_MANY_OPEN_ORDERS",
          "Bạn đang có 3 đơn hàng chờ cửa hàng xử lý.",
        ),
        409,
      ],
      [
        "AMOUNT_TOO_LARGE 409",
        new OrderValidationError("AMOUNT_TOO_LARGE", "Đơn hàng quá lớn"),
        409,
      ],
      ["unexpected 500", new Error("db down"), 500],
    ])(
      "%s carries Cache-Control: private, no-store",
      async (_, error, status) => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(
          createOnlineOrderModule,
          "createOnlineOrder",
        ).mockRejectedValueOnce(error);

        const response = await POST(
          new Request("https://example.com/api/online/orders", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              clientId: "1b0f1f0e-6a51-4d8c-9a55-3f1f5f4a0c10",
              lines: [{ productId: "prod-1", quantity: 1 }],
              contactName: "Khách Hàng A",
              contactPhone: "0901234567",
              fulfillmentType: "pickup",
              paymentMethod: "cod",
            }),
          }),
        );

        expect(response.status).toBe(status);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
      },
    );
  });

  describe("BL-5: voucher failures at checkout share the voucher limiter", () => {
    const GENERIC =
      "Mã giảm giá không hợp lệ hoặc không áp dụng được cho đơn này";

    let store: CountingStore;

    beforeEach(() => {
      store = new CountingStore();
      setVoucherRateLimiter(
        createRateLimiter({ store, secret: "v".repeat(32) }),
      );
    });

    afterEach(() => {
      setVoucherRateLimiter(null);
    });

    function post(voucherCode?: string) {
      return POST(
        new Request("https://example.com/api/online/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientId: crypto.randomUUID(),
            lines: [{ productId: "prod-1", quantity: 1 }],
            contactName: "Khách Hàng A",
            contactPhone: "0901234567",
            fulfillmentType: "pickup",
            paymentMethod: "cod",
            voucherCode,
          }),
        }),
      );
    }

    const created = {
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
    };

    it("repeated voucher failures from one IP end in 429 with Retry-After", async () => {
      const createSpy = vi
        .spyOn(createOnlineOrderModule, "createOnlineOrder")
        .mockRejectedValue(new OnlineOrderError("VOUCHER_INVALID", GENERIC));

      for (let i = 0; i < 30; i++) {
        const response = await post(`DOMA${i}`);
        expect(response.status).toBe(409);
      }

      const limited = await post("DOMA30");
      expect(limited.status).toBe(429);
      expect(limited.headers.get("cache-control")).toBe("private, no-store");
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
      expect((await limited.json()).message).toBe(
        "Bạn thử mã quá nhiều lần. Vui lòng thử lại sau.",
      );
      expect(createSpy).toHaveBeenCalledTimes(30);

      // Bị khoá dò mã vẫn đặt được đơn không kèm mã.
      createSpy.mockResolvedValueOnce(created);
      expect((await post()).status).toBe(201);
    });

    it("successful or unrelated outcomes do not use up the voucher budget", async () => {
      const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");
      createSpy.mockResolvedValue(created);
      for (let i = 0; i < 35; i++) {
        expect((await post("GIAM10")).status).toBe(201);
      }

      createSpy.mockRejectedValue(
        new OnlineOrderError("OUT_OF_STOCK", "Hết hàng", ["prod-1"]),
      );
      for (let i = 0; i < 35; i++) {
        expect((await post("GIAM10")).status).toBe(409);
      }
      expect([...store.counts.values()].every((count) => count === 0)).toBe(
        true,
      );
    });

    it("a checkout without a voucher code does not touch the voucher limiter", async () => {
      vi.spyOn(createOnlineOrderModule, "createOnlineOrder").mockResolvedValue(
        created,
      );
      expect((await post()).status).toBe(201);
      expect((await post("   ")).status).toBe(201);
      expect(store.counts.size).toBe(0);
    });
  });
});

class CountingStore implements RateLimitStore {
  public counts = new Map<string, number>();

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { count, ttlSeconds: windowSeconds };
  }

  async decrement(key: string): Promise<void> {
    const count = this.counts.get(key);
    if (count !== undefined) this.counts.set(key, Math.max(0, count - 1));
  }
}

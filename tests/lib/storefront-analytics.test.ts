import { describe, expect, it, vi } from "vitest";

import {
  getItemCountBucket,
  getQuantityBucket,
  getQueryLengthBucket,
  sanitizeStorefrontEvent,
  trackStorefrontEvent,
  type StorefrontEventPayload,
} from "@/lib/analytics/storefront-events";

describe("Storefront Funnel Analytics & Privacy Protection (Task 13)", () => {
  describe("Bucketing Helpers", () => {
    it("phân loại số lượng (quantityBucket) chính xác", () => {
      expect(getQuantityBucket(1)).toBe("1");
      expect(getQuantityBucket(2)).toBe("2-5");
      expect(getQuantityBucket(5)).toBe("2-5");
      expect(getQuantityBucket(6)).toBe("5+");
      expect(getQuantityBucket(100)).toBe("5+");
    });

    it("phân loại độ dài tìm kiếm mà không lưu nội dung chuỗi (queryLengthBucket)", () => {
      expect(getQueryLengthBucket("")).toBeUndefined();
      expect(getQueryLengthBucket("   ")).toBeUndefined();
      expect(getQueryLengthBucket("sua")).toBe("1-3");
      expect(getQueryLengthBucket("banh mi")).toBe("4-10");
      expect(getQueryLengthBucket("ca phe hoa tan g7")).toBe("10+");
    });

    it("phân loại số lượng món trong giỏ (itemCountBucket) chính xác", () => {
      expect(getItemCountBucket(0)).toBe("0");
      expect(getItemCountBucket(1)).toBe("1-3");
      expect(getItemCountBucket(3)).toBe("1-3");
      expect(getItemCountBucket(4)).toBe("4-10");
      expect(getItemCountBucket(10)).toBe("4-10");
      expect(getItemCountBucket(15)).toBe("10+");
    });
  });

  describe("Event Schema & Privacy Allowlist Sanitization", () => {
    it("cho phép các sự kiện funnel hợp lệ với dữ liệu đã bucket hóa", () => {
      const validEvents: StorefrontEventPayload[] = [
        { event: "view_catalog", categoryId: "cat-1" },
        {
          event: "apply_filter",
          categoryId: "cat-1",
          hasQuery: true,
          queryLengthBucket: "4-10",
        },
        {
          event: "add_to_cart",
          productId: "prod-123",
          quantityBucket: "1",
        },
        { event: "open_cart", itemCountBucket: "1-3" },
        { event: "begin_checkout", itemCountBucket: "4-10" },
        { event: "checkout_step", step: "fulfillment" },
        {
          event: "checkout_result",
          status: "success",
        },
        {
          event: "checkout_result",
          status: "failure",
          errorCategory: "stock",
        },
      ];

      for (const item of validEvents) {
        const result = sanitizeStorefrontEvent(item);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.event).toBe(item.event);
        }
      }
    });

    it("chặn hoặc loại bỏ triệt để các trường PII (phone, address, note, token, rawQuery)", () => {
      const hostilePayload = {
        event: "checkout_result",
        status: "failure",
        errorCategory: "validation",
        // Forbidden PII fields
        phone: "0901234567",
        address: "123 Đường Số 1",
        note: "Giao sau 18h",
        token: "session-secret-abc",
        nonce: "receipt-nonce-xyz",
        guestUrl: "https://example.com/orders/guest/abc",
        rawQuery: "tìm hàng cấm",
      };

      const result = sanitizeStorefrontEvent(hostilePayload);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const sanitized = result.data as Record<string, unknown>;
        expect(sanitized.phone).toBeUndefined();
        expect(sanitized.address).toBeUndefined();
        expect(sanitized.note).toBeUndefined();
        expect(sanitized.token).toBeUndefined();
        expect(sanitized.nonce).toBeUndefined();
        expect(sanitized.guestUrl).toBeUndefined();
        expect(sanitized.rawQuery).toBeUndefined();
      }
    });

    it("từ chối các event không nằm trong allowlist", () => {
      const invalidEvent = {
        event: "user_password_entered",
        password: "secret",
      };

      const result = sanitizeStorefrontEvent(invalidEvent);
      expect(result.ok).toBe(false);
    });
  });

  describe("trackStorefrontEvent Dispatcher", () => {
    it("thực thi an toàn mà không làm sập luồng UI", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Gửi event hợp lệ
      expect(() =>
        trackStorefrontEvent({
          event: "view_catalog",
        }),
      ).not.toThrow();

      // Gửi event không hợp lệ cũng không throw exception ra ngoài UI
      expect(() =>
        trackStorefrontEvent({
          // @ts-expect-error test invalid event type
          event: "invalid_unsupported_event",
        }),
      ).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});

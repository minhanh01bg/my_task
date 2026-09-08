import { z } from "zod";

import { logger } from "@/lib/logger";

/**
 * Phân loại số lượng hàng thêm vào giỏ thành các khoảng (buckets) an toàn
 */
export function getQuantityBucket(quantity: number): "1" | "2-5" | "5+" {
  if (quantity <= 1) return "1";
  if (quantity <= 5) return "2-5";
  return "5+";
}

/**
 * Phân loại độ dài từ khóa tìm kiếm (chỉ lưu khoảng độ dài, tuyệt đối không lưu chuỗi thô)
 */
export function getQueryLengthBucket(
  query?: string | null,
): "1-3" | "4-10" | "10+" | undefined {
  if (!query) return undefined;
  const trimmed = query.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= 3) return "1-3";
  if (trimmed.length <= 10) return "4-10";
  return "10+";
}

/**
 * Phân loại tổng số món trong giỏ hàng
 */
export function getItemCountBucket(
  count: number,
): "0" | "1-3" | "4-10" | "10+" {
  if (count <= 0) return "0";
  if (count <= 3) return "1-3";
  if (count <= 10) return "4-10";
  return "10+";
}

// ============================================================================
// Schemas: Allowlist các sự kiện storefront cho phép
// ============================================================================

export const viewCatalogEventSchema = z.object({
  event: z.literal("view_catalog"),
  categoryId: z.string().optional(),
});

export const applyFilterEventSchema = z.object({
  event: z.literal("apply_filter"),
  categoryId: z.string().optional(),
  hasQuery: z.boolean(),
  queryLengthBucket: z.enum(["1-3", "4-10", "10+"]).optional(),
});

export const addToCartEventSchema = z.object({
  event: z.literal("add_to_cart"),
  productId: z.string(),
  quantityBucket: z.enum(["1", "2-5", "5+"]),
});

export const openCartEventSchema = z.object({
  event: z.literal("open_cart"),
  itemCountBucket: z.enum(["0", "1-3", "4-10", "10+"]),
});

export const beginCheckoutEventSchema = z.object({
  event: z.literal("begin_checkout"),
  itemCountBucket: z.enum(["0", "1-3", "4-10", "10+"]),
});

export const checkoutStepEventSchema = z.object({
  event: z.literal("checkout_step"),
  step: z.enum(["fulfillment", "confirmation"]),
});

export const checkoutResultEventSchema = z.object({
  event: z.literal("checkout_result"),
  status: z.enum(["success", "failure"]),
  errorCategory: z
    .enum(["network", "stock", "validation", "unknown"])
    .optional(),
});

export const storefrontEventSchema = z.discriminatedUnion("event", [
  viewCatalogEventSchema,
  applyFilterEventSchema,
  addToCartEventSchema,
  openCartEventSchema,
  beginCheckoutEventSchema,
  checkoutStepEventSchema,
  checkoutResultEventSchema,
]);

export type StorefrontEventPayload = z.infer<typeof storefrontEventSchema>;

/**
 * Kiểm tra và loại bỏ các trường không nằm trong allowlist (loại bỏ triệt để PII).
 */
export function sanitizeStorefrontEvent(
  rawEvent: unknown,
): { ok: true; data: StorefrontEventPayload } | { ok: false; error: string } {
  const parseResult = storefrontEventSchema.safeParse(rawEvent);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.message,
    };
  }
  return {
    ok: true,
    data: parseResult.data,
  };
}

/**
 * Gửi sự kiện phân tích một cách an toàn mà không làm gián đoạn luồng người dùng
 */
export function trackStorefrontEvent(event: StorefrontEventPayload): void {
  try {
    const result = sanitizeStorefrontEvent(event);
    if (!result.ok) {
      logger.warn("storefront_telemetry_rejected", { error: result.error });
      return;
    }

    // Telemetry sink: ghi log an toàn hoặc forward tới client analytics
    if (process.env.NODE_ENV !== "production") {
      logger.info("storefront_telemetry", { event: result.data });
    }

    // Có thể chuyển tiếp tới window.va (Vercel Analytics) nếu có trên trình duyệt
    if (typeof window !== "undefined" && "va" in window) {
      const va = (
        window as unknown as {
          va: (
            action: string,
            name: string,
            data?: Record<string, unknown>,
          ) => void;
        }
      ).va;
      if (typeof va === "function") {
        va(
          "event",
          result.data.event,
          result.data as unknown as Record<string, unknown>,
        );
      }
    }
  } catch (err: unknown) {
    // Không bao giờ throw ra ngoài UI
    logger.warn("storefront_telemetry_error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

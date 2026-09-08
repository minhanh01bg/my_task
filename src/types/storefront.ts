import { z } from "zod";

export const catalogSortEnum = z.enum([
  "relevance",
  "best-selling",
  "price-asc",
  "price-desc",
  "name-asc",
]);
export type CatalogSort = z.infer<typeof catalogSortEnum>;

export const catalogFilterSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    category: z
      .string()
      .trim()
      .min(1)
      .nullable()
      .optional()
      .transform((val) => (val ? val : null))
      .default(null),
    inStock: z.boolean().default(false),
    minPrice: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .default(null),
    maxPrice: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .default(null),
    sort: catalogSortEnum.default("relevance"),
  })
  .strict()
  .refine(
    (data) => {
      if (data.minPrice !== null && data.maxPrice !== null) {
        return data.minPrice <= data.maxPrice;
      }
      return true;
    },
    {
      message: "minPrice không được lớn hơn maxPrice",
      path: ["minPrice"],
    },
  );

export type CatalogFilter = z.infer<typeof catalogFilterSchema>;

export const cartMutationStatusEnum = z.enum([
  "added",
  "incremented",
  "capped",
  "unavailable",
]);
export type CartMutationStatus = z.infer<typeof cartMutationStatusEnum>;

export const cartMutationResultSchema = z
  .object({
    status: cartMutationStatusEnum,
    productId: z.string().min(1),
    productName: z.string().min(1),
    quantity: z.number().int().nonnegative(),
    maxAvailable: z.number().int().nonnegative().optional(),
    message: z.string().max(255).optional(),
  })
  .strict();

export type CartMutationResult = z.infer<typeof cartMutationResultSchema>;

export const publicStoreProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    hotline: z.string().trim().min(8).max(20).optional(),
    address: z.string().trim().max(255).optional(),
    openingHours: z.string().trim().max(100).optional(),
    mapUrl: z
      .string()
      .url()
      .refine((url) => url.startsWith("https://"), {
        message: "mapUrl phải là URL HTTPS an toàn",
      })
      .optional(),
  })
  .strict();

export type PublicStoreProfile = z.infer<typeof publicStoreProfileSchema>;

export const promotionPlacementEnum = z.enum([
  "hero",
  "announcement",
  "banner",
]);
export type PromotionPlacement = z.infer<typeof promotionPlacementEnum>;

export const publicPromotionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().max(1000).optional(),
    imageUrl: z.string().trim().max(500).optional(),
    ctaLabel: z.string().trim().max(50).optional(),
    ctaHref: z
      .string()
      .trim()
      .max(500)
      .refine((href) => href.startsWith("/") || href.startsWith("https://"), {
        message:
          "ctaHref phải là đường dẫn nội bộ (bắt đầu bằng /) hoặc URL HTTPS an toàn",
      })
      .optional(),
    placement: promotionPlacementEnum,
    priority: z.number().int().default(0),
  })
  .strict();

export type PublicPromotion = z.infer<typeof publicPromotionSchema>;

export const promotionActionSchema = z
  .object({
    id: z.string().trim().optional(),
    title: z
      .string()
      .trim()
      .min(1, "Tiêu đề không được để trống")
      .max(200, "Tiêu đề không vượt quá 200 ký tự"),
    body: z
      .string()
      .trim()
      .max(1000, "Nội dung không vượt quá 1000 ký tự")
      .optional()
      .transform((v) => v || null),
    imageUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null),
    ctaLabel: z
      .string()
      .trim()
      .max(50, "Nhãn nút không vượt quá 50 ký tự")
      .optional()
      .transform((v) => v || null),
    ctaHref: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => v || null)
      .refine(
        (href) => !href || href.startsWith("/") || href.startsWith("https://"),
        {
          message:
            "Liên kết CTA phải là đường dẫn nội bộ (bắt đầu bằng /) hoặc URL HTTPS an toàn",
        },
      ),
    placement: promotionPlacementEnum.default("announcement"),
    startsAt: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : null)),
    endsAt: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(v) : null)),
    priority: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return data.startsAt <= data.endsAt;
      }
      return true;
    },
    {
      message: "Thời gian bắt đầu không được sau thời gian kết thúc",
      path: ["endsAt"],
    },
  );

export type PromotionActionInput = z.infer<typeof promotionActionSchema>;

export type PromotionActionResult =
  | { ok: true; message: string; promotionId?: string }
  | { ok: false; error: string };

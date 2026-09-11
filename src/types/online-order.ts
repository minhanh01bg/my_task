import { z } from "zod";

import { validateAddressHierarchy } from "@/lib/address/vietnam-address";

export const fulfillmentTypeSchema = z.enum(["delivery", "pickup"]);
export const onlinePaymentMethodSchema = z.enum(["cod", "bank_transfer"]);

export function normalizePhone(value: string): string {
  return value.replace(/[\s.()-]/g, "");
}

export const onlineCartLineSchema = z
  .object({
    productId: z.string().trim().min(1).max(100),
    quantity: z.number().finite().positive().max(999),
  })
  .strict();

export const onlineCheckoutSchema = z
  .object({
    clientId: z.string().uuid(),
    lines: z.array(onlineCartLineSchema).min(1).max(50),
    contactName: z.string().trim().min(2).max(100),
    contactPhone: z
      .string()
      .transform(normalizePhone)
      .pipe(
        z.string().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại không hợp lệ"),
      ),
    fulfillmentType: fulfillmentTypeSchema,
    paymentMethod: onlinePaymentMethodSchema,
    deliveryAddress: z.string().trim().max(200).optional().default(""),
    deliveryWard: z.string().trim().max(100).optional().default(""),
    deliveryDistrict: z.string().trim().max(100).optional().default(""),
    deliveryProvince: z.string().trim().max(100).optional().default(""),
    provinceCode: z.string().trim().max(20).optional(),
    districtCode: z.string().trim().max(20).optional(),
    wardCode: z.string().trim().max(20).optional(),
    deliverySlot: z.string().trim().max(100).optional(),
    voucherCode: z.string().trim().max(50).optional(),
    note: z.string().trim().max(500).optional().default(""),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.lines.map((line) => line.productId)).size !==
      value.lines.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Sản phẩm bị trùng",
      });
    }
    if (value.fulfillmentType === "delivery") {
      for (const field of [
        "deliveryAddress",
        "deliveryWard",
        "deliveryDistrict",
        "deliveryProvince",
      ] as const) {
        if (!value[field]?.trim()) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Vui lòng nhập địa chỉ giao hàng đầy đủ",
          });
        }
      }

      if (value.provinceCode || value.districtCode || value.wardCode) {
        const validation = validateAddressHierarchy({
          provinceCode: value.provinceCode,
          districtCode: value.districtCode,
          wardCode: value.wardCode,
          provinceName: value.deliveryProvince,
          districtName: value.deliveryDistrict,
          wardName: value.deliveryWard,
        });
        if (!validation.valid) {
          context.addIssue({
            code: "custom",
            path: [
              value.wardCode && !validation.valid
                ? "wardCode"
                : value.districtCode
                  ? "districtCode"
                  : "provinceCode",
            ],
            message: validation.error ?? "Thông tin địa chỉ không hợp lệ",
          });
        }
      }
    }
  });

export type OnlineCheckoutInput = z.infer<typeof onlineCheckoutSchema>;
export type FulfillmentType = z.infer<typeof fulfillmentTypeSchema>;
export type OnlinePaymentMethod = z.infer<typeof onlinePaymentMethodSchema>;

export const onlineOrderResponseSchema = z.object({
  data: z.object({
    order: z.object({
      code: z.string(),
      total: z.number().int(),
      status: z.string(),
      fulfillmentStatus: z.string(),
      accessUrl: z.string().startsWith("/").optional(),
      receiptUrl: z.string().startsWith("/").optional(),
    }),
    duplicated: z.boolean(),
  }),
});

export type OnlineOrderResponse = z.infer<typeof onlineOrderResponseSchema>;

export class OnlineOrderError extends Error {
  constructor(
    public readonly code:
      | "OUT_OF_STOCK"
      | "PRODUCT_UNAVAILABLE"
      | "IDEMPOTENCY_CONFLICT",
    message: string,
    public readonly productIds: string[] = [],
  ) {
    super(message);
    this.name = "OnlineOrderError";
  }
}

import { z } from "zod";

z.config({ jitless: true });

/** Tien VND so nguyen >= 0; o trong = giu nguyen gia tri dang luu. */
export const optionalMoney = (label: string) =>
  z
    .union([z.literal(""), z.undefined(), z.null(), z.coerce.number()])
    .transform((value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    )
    .pipe(
      z
        .number({ message: `${label} không hợp lệ` })
        .int(`${label} phải là số nguyên`)
        .min(0, `${label} không được âm`)
        .max(100_000_000, `${label} quá lớn`)
        .optional(),
    );

export const adminSettingsSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1, "Tên cửa hàng không được để trống")
    .max(100),
  hotline: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((val) => val || undefined)
    .refine((val) => !val || (val.length >= 8 && /^[0-9+\s().-]+$/.test(val)), {
      message: "Số hotline không hợp lệ (từ 8-20 ký tự)",
    }),
  address: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((val) => val || undefined),
  openingHours: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((val) => val || undefined),
  mapUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((val) => val || undefined)
    .refine(
      (val) => {
        if (!val) return true;
        if (!val.startsWith("https://")) return false;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "mapUrl phải là URL HTTPS an toàn" },
    ),
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng phải là 6 chữ số"),
  accountNumber: z.string().trim().min(1, "Số tài khoản không được để trống"),
  accountName: z.string().trim().min(1, "Tên tài khoản không được để trống"),
  shippingFee: optionalMoney("Phí giao hàng"),
  freeShippingThreshold: optionalMoney("Ngưỡng miễn phí giao hàng"),
});

export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;

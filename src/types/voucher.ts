import { z } from "zod";

import { VOUCHER_TYPES } from "@/lib/vouchers/validate-voucher";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const VOUCHER_CODE = /^[A-Z0-9_-]{3,30}$/;

/** "YYYY-MM-DD" theo giờ Việt Nam -> mốc đầu ngày / cuối ngày. */
export function vnDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000+07:00`);
}

export function vnDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999+07:00`);
}

/** Date -> "YYYY-MM-DD" theo giờ Việt Nam (cho DateField). */
export function toVnDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

const money = z.coerce
  .number({ message: "Số tiền không hợp lệ" })
  .int("Số tiền phải là số nguyên")
  .min(0, "Số tiền không được âm")
  .max(1_000_000_000, "Số tiền quá lớn");

const optionalInt = (schema: z.ZodNumber) =>
  z
    .union([z.literal(""), z.null(), z.undefined(), z.coerce.number()])
    .transform((value) =>
      value === "" || value === null || value === undefined ? null : value,
    )
    .pipe(schema.nullable());

const optionalDay = z
  .union([z.literal(""), z.undefined(), z.null(), z.string().regex(DATE_ONLY)])
  .transform((value) => value || null);

/** Dữ liệu form admin tạo/sửa voucher. */
export const voucherInputSchema = z
  .object({
    code: z
      .string({ message: "Vui lòng nhập mã" })
      .transform((value) => value.trim().toUpperCase())
      .pipe(
        z
          .string()
          .regex(
            VOUCHER_CODE,
            "Mã gồm 3-30 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới",
          ),
      ),
    type: z.enum(VOUCHER_TYPES, { message: "Loại voucher không hợp lệ" }),
    value: money.default(0),
    maxDiscount: optionalInt(
      z.number().int().min(1, "Mức giảm tối đa phải lớn hơn 0").max(1e9),
    ),
    minOrderTotal: money.default(0),
    maxUses: optionalInt(
      z.number().int().min(1, "Số lượt tối đa phải từ 1 trở lên").max(1e7),
    ),
    startsAt: optionalDay,
    endsAt: optionalDay,
    isActive: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.type === "percent" && (value.value < 1 || value.value > 100)) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Phần trăm giảm phải từ 1 đến 100",
      });
    }
    if (value.type === "fixed" && value.value < 1) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Số tiền giảm phải lớn hơn 0",
      });
    }
    if (value.startsAt && value.endsAt && value.endsAt < value.startsAt) {
      context.addIssue({
        code: "custom",
        path: ["endsAt"],
        message: "Ngày kết thúc phải sau ngày bắt đầu",
      });
    }
  })
  .transform((value) => ({
    code: value.code,
    type: value.type,
    value: value.type === "freeship" ? 0 : value.value,
    maxDiscount: value.type === "fixed" ? null : value.maxDiscount,
    minOrderTotal: value.minOrderTotal,
    maxUses: value.maxUses,
    startsAt: value.startsAt ? vnDayStart(value.startsAt) : null,
    endsAt: value.endsAt ? vnDayEnd(value.endsAt) : null,
    isActive: value.isActive,
  }));

export type VoucherInput = z.output<typeof voucherInputSchema>;

export type VoucherActionResult =
  | { ok: true; message: string; voucherId?: string }
  | { ok: false; error: string };

/** Body của `POST /api/online/vouchers/validate`. */
export const voucherValidateRequestSchema = z
  .object({
    code: z.string().trim().min(1, "Chưa nhập mã giảm giá").max(50),
    subtotal: z.number().int().min(0).max(10_000_000_000),
  })
  .strict();

export const voucherValidateResponseSchema = z.object({
  data: z.discriminatedUnion("ok", [
    z.object({
      ok: z.literal(true),
      code: z.string(),
      type: z.enum(VOUCHER_TYPES),
      value: z.number().int(),
      maxDiscount: z.number().int().nullable(),
      minOrderTotal: z.number().int(),
      discount: z.number().int(),
      shippingDiscount: z.number().int(),
      message: z.string(),
    }),
    z.object({
      ok: z.literal(false),
      code: z.string(),
      message: z.string(),
    }),
  ]),
});

export type VoucherValidateResponse = z.infer<
  typeof voucherValidateResponseSchema
>;

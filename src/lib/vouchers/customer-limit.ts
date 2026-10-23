import { z } from "zod";

z.config({ jitless: true });

/** Trần nhập tay, tránh admin gõ nhầm một số quá lớn. */
export const MAX_USES_PER_CUSTOMER_CAP = 100;

const LIMIT_MESSAGE = `Số lần mỗi khách phải là số nguyên từ 1 đến ${MAX_USES_PER_CUSTOMER_CAP}`;

/**
 * Số lần mỗi khách được dùng một mã, dạng chuỗi (form / bảng Setting).
 * Chuỗi rỗng = không giới hạn (`null`).
 */
export const maxUsesPerCustomerSchema = z
  .string({ message: LIMIT_MESSAGE })
  .trim()
  .regex(/^\d*$/, LIMIT_MESSAGE)
  .transform((value) => (value === "" ? null : Number(value)))
  .pipe(
    z
      .number()
      .int(LIMIT_MESSAGE)
      .min(1, LIMIT_MESSAGE)
      .max(MAX_USES_PER_CUSTOMER_CAP, LIMIT_MESSAGE)
      .nullable(),
  );

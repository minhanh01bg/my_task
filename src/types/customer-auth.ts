import { z } from "zod";

export function canonicalizeVietnamesePhone(value: string): string {
  const compact = value.trim().replace(/[\s.()-]/g, "");
  if (compact.startsWith("0")) return `+84${compact.slice(1)}`;
  if (compact.startsWith("84")) return `+${compact}`;
  return compact;
}

export const customerPhoneSchema = z
  .string()
  .transform(canonicalizeVietnamesePhone)
  .pipe(z.string().regex(/^\+84\d{9,10}$/, "Số điện thoại không hợp lệ"));

const passwordSchema = z.string().min(10).max(128);

export const customerRegisterSchema = z
  .object({
    phone: customerPhoneSchema,
    displayName: z.string().trim().min(2).max(100),
    password: passwordSchema,
  })
  .strict();

export const customerLoginSchema = z
  .object({ phone: customerPhoneSchema, password: passwordSchema })
  .strict();

export const customerAuthResponseSchema = z
  .object({
    data: z
      .object({ account: z.object({ displayName: z.string() }).strict() })
      .strict(),
  })
  .strict();

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;

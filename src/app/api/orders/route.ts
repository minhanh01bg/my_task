import { NextResponse } from "next/server";
import { z } from "zod";

import { MAX_INT_VND } from "@/lib/money";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import { createOrder } from "@/server/orders/create-order";
import { OrderValidationError } from "@/server/orders/order-validation-error";

/** Đơn 200 dòng thực tế chỉ vài chục KB; quá mức này gần như chắc chắn là lạm dụng. */
const MAX_ORDER_BODY_BYTES = 128_000;
/**
 * Vượt cột `Int` thì trả 400 (lỗi vĩnh viễn, giữ lại để xử lý tay) thay vì để
 * Prisma ném 500 khiến hàng đợi offline gửi lại mãi.
 */
const moneySchema = z.number().int().min(0).max(MAX_INT_VND);

const lineSchema = z
  .object({
    productId: z.string().max(100).nullable(),
    name: z.string().min(1).max(300),
    unitPrice: moneySchema,
    originalPrice: moneySchema,
    quantity: z.number().finite().positive().max(100_000),
    discount: moneySchema.default(0),
    unit: z.string().max(50).default("cái"),
    isService: z.boolean().default(false),
  })
  .strict();

const paymentSchema = z
  .object({
    method: z.enum(["cash", "transfer", "debt"]),
    amount: moneySchema,
    receivedAt: z.coerce.date().nullable().optional(),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();

const bodySchema = z
  .object({
    clientId: z.string().min(1).max(100),
    preferredCode: z
      .string()
      .max(30)
      .regex(/^DH\d+$/)
      .nullable()
      .optional(),
    channel: z.enum(["pos", "online"]).default("pos"),
    lines: z.array(lineSchema).min(1).max(200),
    orderDiscount: moneySchema.default(0),
    payments: z.array(paymentSchema).min(1).max(10),
    customerId: z.string().max(100).nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { message: "Nguồn gốc yêu cầu không hợp lệ" },
      { status: 403 },
    );
  }

  const body = await readJsonBody(request, { maxBytes: MAX_ORDER_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json(
      { message: body.message },
      { status: body.status },
    );
  }

  const parsed = bodySchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu đơn hàng không hợp lệ" },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof createOrder>>;
  try {
    result = await createOrder(parsed.data);
  } catch (error: unknown) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 422 },
      );
    }
    throw error;
  }

  return NextResponse.json(result, { status: result.duplicated ? 200 : 201 });
}

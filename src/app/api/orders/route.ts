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
/** Đồng hồ máy bán lệch vài phút là thường; xa hơn thì dùng giờ server. */
const MAX_RECEIVED_AT_SKEW_MS = 5 * 60_000;
/** Phản hồi chứa mã/tổng đơn: không cho proxy hay trình duyệt lưu lại. */
const NO_STORE = { "Cache-Control": "private, no-store" };

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
    // Máy POS vẫn gửi "pos"; đơn online chỉ đi qua /api/online/orders.
    channel: z.literal("pos").optional(),
    lines: z.array(lineSchema).min(1).max(200),
    orderDiscount: moneySchema.default(0),
    payments: z.array(paymentSchema).min(1).max(10),
    customerId: z.string().max(100).nullable().optional(),
    note: z.string().max(1000).nullable().optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { message: "Chưa đăng nhập" },
      { status: 401, headers: NO_STORE },
    );
  }

  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { message: "Nguồn gốc yêu cầu không hợp lệ" },
      { status: 403, headers: NO_STORE },
    );
  }

  const body = await readJsonBody(request, { maxBytes: MAX_ORDER_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json(
      { message: body.message },
      { status: body.status, headers: NO_STORE },
    );
  }

  const parsed = bodySchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu đơn hàng không hợp lệ" },
      { status: 400, headers: NO_STORE },
    );
  }

  // Giờ nhận tiền quá khứ vẫn hợp lệ (đơn xếp hàng offline gửi muộn); giờ
  // tương lai xa thì kẹp về hiện tại thay vì từ chối, để không mất đơn đã thu.
  const now = new Date();
  const payments = parsed.data.payments.map((payment) =>
    payment.receivedAt &&
    payment.receivedAt.getTime() > now.getTime() + MAX_RECEIVED_AT_SKEW_MS
      ? { ...payment, receivedAt: now }
      : payment,
  );

  let result: Awaited<ReturnType<typeof createOrder>>;
  try {
    result = await createOrder({ ...parsed.data, channel: "pos", payments });
  } catch (error: unknown) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: 422, headers: NO_STORE },
      );
    }
    throw error;
  }

  return NextResponse.json(result, {
    status: result.duplicated ? 200 : 201,
    headers: NO_STORE,
  });
}

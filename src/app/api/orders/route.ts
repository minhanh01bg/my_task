import { NextResponse } from "next/server";
import { z } from "zod";

import { createOrder } from "@/server/orders/create-order";

const lineSchema = z.object({
  productId: z.string().nullable(),
  name: z.string().min(1),
  unitPrice: z.number().int().min(0),
  originalPrice: z.number().int().min(0),
  quantity: z.number().positive(),
  discount: z.number().int().min(0).default(0),
  unit: z.string().default("cái"),
  isService: z.boolean().default(false),
});

const paymentSchema = z.object({
  method: z.enum(["cash", "transfer", "debt"]),
  amount: z.number().int().min(0),
  receivedAt: z.coerce.date().nullable().optional(),
  note: z.string().nullable().optional(),
});

const bodySchema = z.object({
  clientId: z.string().min(1),
  channel: z.enum(["pos", "online"]).default("pos"),
  lines: z.array(lineSchema).min(1),
  orderDiscount: z.number().int().min(0).default(0),
  payments: z.array(paymentSchema).min(1),
  customerId: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu đơn hàng không hợp lệ", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await createOrder(parsed.data);

  return NextResponse.json(result, { status: result.duplicated ? 200 : 201 });
}

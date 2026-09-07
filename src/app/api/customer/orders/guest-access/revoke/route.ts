import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveCustomerSessionToken } from "@/server/customer-auth/session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import { revokeGuestAccess } from "@/server/orders/order-access";

const revokeBodySchema = z.object({
  orderId: z.string().min(1),
});

export async function POST(request: Request) {
  // Layer 1: CSRF & Origin validation
  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ" },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 2: Authentication
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)customer_session=([^;]+)/)?.[1];
  const session = await resolveCustomerSessionToken(
    cookie ? decodeURIComponent(cookie) : null,
  );

  if (!session) {
    return NextResponse.json(
      { message: "Chưa đăng nhập" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 3: Body parsing
  const bodyResult = await readJsonBody(request, { maxBytes: 16_000 });
  if (!bodyResult.ok) {
    return NextResponse.json(
      { message: bodyResult.message },
      {
        status: bodyResult.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const parsed = revokeBodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu không hợp lệ" },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 4: Revoke execution for order owner
  const result = await revokeGuestAccess({
    customerAccountId: session.accountId,
    orderId: parsed.data.orderId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { message: "Không tìm thấy đơn hàng" },
      {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

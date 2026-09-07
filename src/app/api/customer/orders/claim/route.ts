import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveCustomerSessionToken } from "@/server/customer-auth/session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import { claimGuestOrder } from "@/server/orders/order-access";

const claimBodySchema = z.object({
  token: z.string().min(1),
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

  const parsed = claimBodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu không hợp lệ" },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 4: Claim execution with strong ownership proof
  const claimResult = await claimGuestOrder({
    customerAccountId: session.accountId,
    guestToken: parsed.data.token,
  });

  if (!claimResult.ok) {
    // Indistinguishable 404 response for invalid, expired, revoked, or phone-mismatched claims
    return NextResponse.json(
      { message: "Không tìm thấy đơn hàng hoặc liên kết đã hết hạn" },
      {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  return NextResponse.json(
    { ok: true, orderId: claimResult.orderId },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

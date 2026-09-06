import { NextResponse } from "next/server";

import { hasSafeMutationOrigin } from "@/server/http/origin";
import {
  CUSTOMER_SESSION_COOKIE,
  revokeCustomerSession,
} from "@/server/customer-auth/session";

export async function POST(request: Request) {
  if (!hasSafeMutationOrigin(request))
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ" },
      { status: 403 },
    );
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)customer_session=([^;]+)/)?.[1];
  await revokeCustomerSession(cookie ? decodeURIComponent(cookie) : null);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

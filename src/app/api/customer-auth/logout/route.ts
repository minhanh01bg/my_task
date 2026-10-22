import { NextResponse } from "next/server";

import { hasSafeMutationOrigin } from "@/server/http/origin";
import {
  CUSTOMER_SESSION_COOKIE,
  readCustomerSessionToken,
  revokeCustomerSession,
} from "@/server/customer-auth/session";

export async function POST(request: Request) {
  if (!hasSafeMutationOrigin(request))
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ" },
      { status: 403 },
    );
  // An undecodable cookie has no session to revoke, but still gets cleared.
  await revokeCustomerSession(readCustomerSessionToken(request));
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

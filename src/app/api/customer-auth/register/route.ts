import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";
import { hashCustomerPassword } from "@/server/customer-auth/password";
import {
  consumeCustomerAuthAttempt,
  getRequestIp,
  rateLimitKey,
} from "@/server/customer-auth/rate-limit";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  customerCookieOptions,
} from "@/server/customer-auth/session";
import { customerRegisterSchema } from "@/types/customer-auth";

export async function POST(request: Request) {
  const parsed = customerRegisterSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return NextResponse.json(
      { message: "Thông tin đăng ký không hợp lệ" },
      { status: 400 },
    );
  const key = rateLimitKey(getRequestIp(request), parsed.data.phone);
  if (!consumeCustomerAuthAttempt(key))
    return NextResponse.json(
      { message: "Vui lòng thử lại sau" },
      { status: 429 },
    );

  const existing = await prisma.customerAccount.findUnique({
    where: { phoneNormalized: parsed.data.phone },
    select: { id: true },
  });
  if (existing)
    return NextResponse.json(
      { message: "Không thể tạo tài khoản với thông tin này" },
      { status: 409 },
    );

  const passwordHash = await hashCustomerPassword(parsed.data.password);
  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized: parsed.data.phone,
      displayName: parsed.data.displayName,
      passwordHash,
    },
    select: { id: true, displayName: true },
  });
  const session = await createCustomerSession(account.id);
  const response = NextResponse.json(
    { data: { account: { displayName: account.displayName } } },
    { status: 201 },
  );
  response.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    session.token,
    customerCookieOptions,
  );
  return response;
}

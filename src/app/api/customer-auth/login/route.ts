import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";
import { verifyCustomerPassword } from "@/server/customer-auth/password";
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
import { customerLoginSchema } from "@/types/customer-auth";

const GENERIC_ERROR = { message: "Số điện thoại hoặc mật khẩu không đúng" };

export async function POST(request: Request) {
  const parsed = customerLoginSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return NextResponse.json(GENERIC_ERROR, { status: 401 });
  if (
    !consumeCustomerAuthAttempt(
      rateLimitKey(getRequestIp(request), parsed.data.phone),
    )
  ) {
    return NextResponse.json(
      { message: "Vui lòng thử lại sau" },
      { status: 429 },
    );
  }
  const account = await prisma.customerAccount.findUnique({
    where: { phoneNormalized: parsed.data.phone },
    select: {
      id: true,
      displayName: true,
      passwordHash: true,
      disabledAt: true,
    },
  });
  const valid =
    account &&
    !account.disabledAt &&
    (await verifyCustomerPassword(parsed.data.password, account.passwordHash));
  if (!valid || !account)
    return NextResponse.json(GENERIC_ERROR, { status: 401 });

  const session = await createCustomerSession(account.id);
  const response = NextResponse.json({
    data: { account: { displayName: account.displayName } },
  });
  response.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    session.token,
    customerCookieOptions,
  );
  return response;
}

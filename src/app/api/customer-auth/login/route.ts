import { NextResponse } from "next/server";

import { readJsonBody } from "@/server/http/read-json-body";
import { verifyCustomerPassword } from "@/server/customer-auth/password";
import {
  checkCustomerAuthAccount,
  checkCustomerAuthPreCheck,
  resetCustomerAuthAccount,
} from "@/server/customer-auth/rate-limit";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  customerCookieOptions,
} from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";
import { customerLoginSchema } from "@/types/customer-auth";

const GENERIC_ERROR = { message: "Số điện thoại hoặc mật khẩu không đúng" };

export async function POST(request: Request) {
  // Layer 1: Streamed body cap (16 KB)
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

  // Layer 2: Pre-parse IP, subnet, and global rate limit check
  const preCheck = await checkCustomerAuthPreCheck(request);
  if (!preCheck.ok) {
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (preCheck.retryAfterSeconds) {
      headers["Retry-After"] = String(preCheck.retryAfterSeconds);
    }
    return NextResponse.json(
      { message: preCheck.message },
      { status: preCheck.status, headers },
    );
  }

  // Layer 3: Validate input schema
  const parsed = customerLoginSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_ERROR, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Layer 4: Velocity check on normalized phone number
  const accountCheck = await checkCustomerAuthAccount(parsed.data.phone);
  if (!accountCheck.ok) {
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (accountCheck.retryAfterSeconds) {
      headers["Retry-After"] = String(accountCheck.retryAfterSeconds);
    }
    return NextResponse.json(
      { message: accountCheck.message },
      { status: accountCheck.status, headers },
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

  if (!valid || !account) {
    return NextResponse.json(GENERIC_ERROR, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Reset the account-level failure counter on successful login
  await resetCustomerAuthAccount(parsed.data.phone);

  const session = await createCustomerSession(account.id);
  const response = NextResponse.json(
    { data: { account: { displayName: account.displayName } } },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
  response.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    session.token,
    customerCookieOptions,
  );
  return response;
}

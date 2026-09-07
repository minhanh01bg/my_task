import { NextResponse } from "next/server";

import { readJsonBody } from "@/server/http/read-json-body";
import { hashCustomerPassword } from "@/server/customer-auth/password";
import {
  checkCustomerAuthAccount,
  checkCustomerAuthPreCheck,
} from "@/server/customer-auth/rate-limit";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  customerCookieOptions,
} from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";
import { customerRegisterSchema } from "@/types/customer-auth";

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
  const parsed = customerRegisterSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Thông tin đăng ký không hợp lệ" },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
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

  const existing = await prisma.customerAccount.findUnique({
    where: { phoneNormalized: parsed.data.phone },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { message: "Không thể tạo tài khoản với thông tin này" },
      {
        status: 409,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

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
    {
      status: 201,
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

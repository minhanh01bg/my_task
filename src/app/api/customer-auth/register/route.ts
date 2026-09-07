import { NextResponse } from "next/server";

import { readJsonBody } from "@/server/http/read-json-body";
import { hashCustomerPassword } from "@/server/customer-auth/password";
import {
  checkCustomerAuthAccount,
  checkCustomerAuthPreCheck,
} from "@/server/customer-auth/rate-limit";
import { registerCustomerAccountWithOptionalSession } from "@/server/customer-auth/session";
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

  // Timing equalization: always hash password regardless of whether account exists
  const passwordHash = await hashCustomerPassword(parsed.data.password);

  // Atomic database persist with graceful conflict handling (P2002)
  await registerCustomerAccountWithOptionalSession({
    phoneNormalized: parsed.data.phone,
    displayName: parsed.data.displayName,
    passwordHash,
    createSession: false,
  });

  // Privacy-first policy: externally equivalent accepted response for both new and existing phones
  return NextResponse.json(
    {
      ok: true,
      message:
        "Nếu thông tin hợp lệ, tài khoản đã được xử lý. Vui lòng đăng nhập hoặc sử dụng chức năng khôi phục tài khoản.",
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

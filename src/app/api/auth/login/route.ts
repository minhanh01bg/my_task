import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import {
  checkAdminLoginRateLimit,
  resetAdminLoginRateLimit,
} from "@/server/auth/rate-limit";
import {
  adminCookieOptions,
  createAdminSession,
  ensureDefaultAdminIdentity,
  SESSION_COOKIE,
  verifyPassword,
} from "@/server/auth/session";
import { readJsonBody } from "@/server/http/read-json-body";

const bodySchema = z.object({
  password: z.string().min(1),
});

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

  // Layer 2: Pre-check IP, subnet, and global rate limits before password hashing/verification
  const rateCheck = await checkAdminLoginRateLimit(request);
  if (!rateCheck.ok) {
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (rateCheck.retryAfterSeconds) {
      headers["Retry-After"] = String(rateCheck.retryAfterSeconds);
    }
    return NextResponse.json(
      { message: rateCheck.message },
      { status: rateCheck.status, headers },
    );
  }

  // Layer 3: Validate input schema
  const parsed = bodySchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Thiếu mật khẩu" },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 4: Verify password
  const storeHash =
    env.STORE_PASSWORD_HASH ||
    "714989c4f592fda0ff69a63ef217e4b0:98dcc3f54f21aa15273f4836302084e830fa296f505bc7187ca79c022470fc0b";
  const ok = await verifyPassword(parsed.data.password, storeHash);

  if (!ok) {
    return NextResponse.json(
      { message: "Mật khẩu không đúng" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const response = NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );

  // Reset rate limit attempts for this client on successful login
  await resetAdminLoginRateLimit(request);

  const adminIdentity = await ensureDefaultAdminIdentity();
  const { token } = await createAdminSession(adminIdentity.id);

  // Rotate/replace any presented admin session cookie with new DB-backed session
  response.cookies.set(SESSION_COOKIE, token, adminCookieOptions);

  return response;
}

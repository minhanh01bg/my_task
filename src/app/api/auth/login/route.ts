import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import {
  checkAdminLoginRateLimit,
  resetAdminLoginRateLimit,
} from "@/server/auth/rate-limit";
import { resolveAdminSessionToken } from "@/server/auth/require-admin-session";
import {
  adminCookieOptionsForRequest,
  createAdminSession,
  ensureDefaultAdminIdentity,
  revokeAdminSession,
  revokeAdminSessionsOnPasswordChange,
  SESSION_COOKIE,
  verifyPassword,
} from "@/server/auth/session";
import {
  ADMIN_TRUSTED_DEVICE_COOKIE,
  adminTrustedDeviceCookieOptions,
  createAdminTrustedDeviceToken,
  resolveAdminTrustedDevice,
} from "@/server/auth/trusted-device";
import { readJsonBody } from "@/server/http/read-json-body";
import { hasSafeMutationOrigin } from "@/server/http/origin";

const bodySchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    if (!hasSafeMutationOrigin(request)) {
      return NextResponse.json(
        { message: "Yêu cầu từ nguồn không tin cậy" },
        {
          status: 403,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }

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

    // Layer 2: Pre-check IP, subnet, and global rate limits before password hashing/verification.
    // A device that logged in before swaps the shared subnet/global budgets for its own.
    const storeHash = env.STORE_PASSWORD_HASH;
    const trustedDeviceId = resolveAdminTrustedDevice(request, storeHash);
    const rateCheck = await checkAdminLoginRateLimit(request, {
      trustedDeviceId,
    });
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
    if (!storeHash) {
      return NextResponse.json(
        { message: "Chưa cấu hình mật khẩu cửa hàng" },
        {
          status: 503,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
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
    await resetAdminLoginRateLimit(request, { trustedDeviceId });

    const adminIdentity = await ensureDefaultAdminIdentity();
    // The presented session is replaced below, so it must not stay valid.
    await revokeAdminSession(await resolveAdminSessionToken(request));
    await revokeAdminSessionsOnPasswordChange(adminIdentity.id, storeHash);
    const { token } = await createAdminSession(adminIdentity.id);

    // Rotate/replace any presented admin session cookie with new DB-backed session
    response.cookies.set(
      SESSION_COOKIE,
      token,
      adminCookieOptionsForRequest(request),
    );

    const deviceToken = createAdminTrustedDeviceToken(storeHash);
    if (deviceToken) {
      response.cookies.set(
        ADMIN_TRUSTED_DEVICE_COOKIE,
        deviceToken,
        adminTrustedDeviceCookieOptions(request),
      );
    }

    return response;
  } catch (error) {
    const correlationId = crypto.randomUUID();
    const errorClass =
      error instanceof Error ? error.constructor.name : typeof error;
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "INTERNAL_ERROR";

    logger.error("admin_login_error", {
      correlationId,
      errorClass,
      errorCode,
    });

    return NextResponse.json(
      {
        message: "Lỗi hệ thống khi tạo phiên đăng nhập. Vui lòng thử lại.",
        correlationId,
      },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}

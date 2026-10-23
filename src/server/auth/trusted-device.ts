import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { env } from "@/config/env";
import { readCookie } from "@/server/auth/require-admin-session";
import { adminCookieOptionsForRequest } from "@/server/auth/session";

/**
 * "Known device" cookies for login rate limiting. A browser that logged in
 * successfully gets a signed, stateless token; presenting it on the next login
 * skips the failure budgets anyone can drain to lock the real user out, while
 * the per-IP bucket and a per-device bucket still apply. The token grants no
 * access by itself: the password is always verified.
 */
export const TRUSTED_DEVICE_MAX_AGE_SECONDS = 60 * 24 * 60 * 60; // 60 days

export const ADMIN_TRUSTED_DEVICE_COOKIE = "pos_trusted_device";
const ADMIN_TRUSTED_DEVICE_LABEL = "admin-login";

// id (16 random bytes) . expiry (unix seconds) . HMAC-SHA256, all base64url.
const TOKEN_PATTERN =
  /^([A-Za-z0-9_-]{22})\.([1-9]\d{0,11})\.([A-Za-z0-9_-]{43})$/;

// Same dev/test fallback as createRateLimiter(); production env validation
// requires RATE_LIMIT_KEY_SECRET, and without it devices are never trusted.
function deviceKey(label: string): Buffer | null {
  const secret =
    env.RATE_LIMIT_KEY_SECRET ??
    (process.env.NODE_ENV === "production"
      ? null
      : "dev-test-rate-limit-secret-32-characters");
  if (!secret) return null;
  return Buffer.from(
    hkdfSync("sha256", secret, "", `trusted-device:${label}:v1`, 32),
  );
}

function sign(key: Buffer, id: string, expiresAt: string, binding: string) {
  return createHmac("sha256", key)
    .update(`${id}.${expiresAt}.${binding}`)
    .digest("base64url");
}

/** `binding` ties the token to what it was issued for (account, password). */
export function createTrustedDeviceToken(
  label: string,
  binding: string,
  now = Date.now(),
): string | null {
  const key = deviceKey(label);
  if (!key || !binding) return null;
  const id = randomBytes(16).toString("base64url");
  const expiresAt = String(
    Math.floor(now / 1000) + TRUSTED_DEVICE_MAX_AGE_SECONDS,
  );
  return `${id}.${expiresAt}.${sign(key, id, expiresAt, binding)}`;
}

/** Device id of a genuine, unexpired token for `binding`, otherwise null. */
export function verifyTrustedDeviceToken(
  label: string,
  token: string | null | undefined,
  binding: string,
  now = Date.now(),
): string | null {
  const match = token ? TOKEN_PATTERN.exec(token) : null;
  const key = deviceKey(label);
  if (!match || !key || !binding) return null;
  const [, id, expiresAt, mac] = match;
  if (Number(expiresAt) * 1000 <= now) return null;
  const expected = Buffer.from(sign(key, id, expiresAt, binding));
  return timingSafeEqual(Buffer.from(mac), expected) ? id : null;
}

// Rotating STORE_PASSWORD_HASH forgets every trusted device.
function adminBinding(passwordHash: string): string {
  return passwordHash
    ? createHash("sha256").update(passwordHash, "utf8").digest("hex")
    : "";
}

export function createAdminTrustedDeviceToken(
  passwordHash: string,
  now?: number,
): string | null {
  return createTrustedDeviceToken(
    ADMIN_TRUSTED_DEVICE_LABEL,
    adminBinding(passwordHash),
    now,
  );
}

/** Device id from the request's admin device cookie, if it is still valid. */
export function resolveAdminTrustedDevice(
  request: Request,
  passwordHash: string,
): string | null {
  return verifyTrustedDeviceToken(
    ADMIN_TRUSTED_DEVICE_LABEL,
    readCookie(request.headers.get("cookie"), ADMIN_TRUSTED_DEVICE_COOKIE),
    adminBinding(passwordHash),
  );
}

/** Sent only to the login endpoint, the one place that reads it. */
export function adminTrustedDeviceCookieOptions(request: Request) {
  return {
    ...adminCookieOptionsForRequest(request),
    path: "/api/auth/login",
    maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
  };
}

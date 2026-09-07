import { createHash } from "node:crypto";

import {
  resolveTrustedClientIp,
  type TrustedProxyMode,
} from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/security/rate-limit";
import { POLICIES } from "@/server/security/rate-limit-policy";

let defaultLimiter: RateLimiter | null = null;

export function setCustomerAuthLimiter(limiter: RateLimiter | null): void {
  defaultLimiter = limiter;
}

function getLimiter(injected?: RateLimiter): RateLimiter {
  if (injected) return injected;
  if (!defaultLimiter) {
    defaultLimiter = createRateLimiter();
  }
  return defaultLimiter;
}

export interface CustomerAuthGuardOptions {
  limiter?: RateLimiter;
  proxyMode?: TrustedProxyMode;
  customHeader?: string;
  isProduction?: boolean;
}

export type CustomerAuthCheckResult =
  | { ok: true; ip?: string; subnet?: string }
  | {
      ok: false;
      status: 429 | 503;
      retryAfterSeconds: number;
      message: string;
    };

/**
 * Cheap pre-parse rate limit check evaluated against IP, subnet, and global limits
 * before expensive JSON decoding, password hashing, or database queries.
 */
export async function checkCustomerAuthPreCheck(
  request: Request,
  opts?: CustomerAuthGuardOptions | RateLimiter,
): Promise<CustomerAuthCheckResult> {
  const options: CustomerAuthGuardOptions =
    opts && "check" in opts ? { limiter: opts } : (opts ?? {});

  const ipResult = resolveTrustedClientIp(request, {
    mode: options.proxyMode,
    customHeader: options.customHeader,
    isProduction: options.isProduction,
  });

  if (!ipResult.ok) {
    return {
      ok: false,
      status: 503,
      retryAfterSeconds: 60,
      message: "Dịch vụ tạm thời không khả dụng",
    };
  }

  const limiter = getLimiter(options.limiter);
  const decision = await limiter.check(POLICIES.customerAuth, [
    { bucketName: "ip-attempts", dimension: "ip", identifier: ipResult.ip },
    {
      bucketName: "subnet-attempts",
      dimension: "subnet",
      identifier: ipResult.subnet,
    },
    { bucketName: "global-attempts", dimension: "global", identifier: "all" },
  ]);

  if (!decision.allowed) {
    if (decision.reason === "limiter_unavailable") {
      return {
        ok: false,
        status: 503,
        retryAfterSeconds: decision.retryAfterSeconds,
        message: "Dịch vụ tạm thời không khả dụng",
      };
    }
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: decision.retryAfterSeconds,
      message: "Vui lòng thử lại sau",
    };
  }

  return {
    ok: true,
    ip: ipResult.ip,
    subnet: ipResult.subnet,
  };
}

/**
 * Account-specific velocity check evaluated on normalized phone number
 * after schema parsing and before password verification or registration writes.
 */
export async function checkCustomerAuthAccount(
  phoneNormalized: string,
  injectedLimiter?: RateLimiter,
): Promise<CustomerAuthCheckResult> {
  const limiter = getLimiter(injectedLimiter);
  const decision = await limiter.check(POLICIES.customerAuth, [
    {
      bucketName: "phone-attempts",
      dimension: "phone",
      identifier: phoneNormalized,
    },
  ]);

  if (!decision.allowed) {
    if (decision.reason === "limiter_unavailable") {
      return {
        ok: false,
        status: 503,
        retryAfterSeconds: decision.retryAfterSeconds,
        message: "Dịch vụ tạm thời không khả dụng",
      };
    }
    return {
      ok: false,
      status: 429,
      retryAfterSeconds: decision.retryAfterSeconds,
      message: "Vui lòng thử lại sau",
    };
  }

  return { ok: true };
}

/**
 * Resets the account-specific failure bucket on successful login,
 * without clearing or altering IP, subnet, or global counters.
 */
export async function resetCustomerAuthAccount(
  phoneNormalized: string,
  injectedLimiter?: RateLimiter,
): Promise<void> {
  const limiter = getLimiter(injectedLimiter);
  if (typeof limiter.reset === "function") {
    await limiter.reset(POLICIES.customerAuth, {
      bucketName: "phone-attempts",
      dimension: "phone",
      identifier: phoneNormalized,
    });
  }
}

// Legacy helpers retained for backward compatibility
const legacyAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * @deprecated Use checkCustomerAuthPreCheck and checkCustomerAuthAccount instead.
 */
export function rateLimitKey(ip: string, phone: string): string {
  return createHash("sha256").update(`${ip}|${phone}`).digest("hex");
}

/**
 * @deprecated Use checkCustomerAuthPreCheck and checkCustomerAuthAccount instead.
 */
export function consumeCustomerAuthAttempt(
  key: string,
  now = Date.now(),
): boolean {
  const current = legacyAttempts.get(key);
  if (!current || current.resetAt <= now) {
    legacyAttempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

/**
 * @deprecated Unsafe client IP resolver that trusts client-supplied x-forwarded-for.
 * Use resolveTrustedClientIp from "@/server/http/client-ip" instead.
 */
export function getRequestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  );
}

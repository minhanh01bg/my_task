import {
  rateLimitClientId,
  resolveTrustedClientIp,
  type ClientIpResolution,
  type TrustedProxyMode,
} from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitTarget,
} from "@/server/security/rate-limit";
import { POLICIES } from "@/server/security/rate-limit-policy";

let defaultLimiter: RateLimiter | null = null;

export function setAdminLoginLimiter(limiter: RateLimiter | null): void {
  defaultLimiter = limiter;
}

function getLimiter(injected?: RateLimiter): RateLimiter {
  if (injected) return injected;
  if (!defaultLimiter) {
    defaultLimiter = createRateLimiter();
  }
  return defaultLimiter;
}

export interface AdminLoginGuardOptions {
  limiter?: RateLimiter;
  proxyMode?: TrustedProxyMode;
  customHeader?: string;
  isProduction?: boolean;
  /** Id from a valid device cookie, see `resolveAdminTrustedDevice()`. */
  trustedDeviceId?: string | null;
}

function ipTarget(
  ipResult: Extract<ClientIpResolution, { ok: true }>,
): RateLimitTarget {
  return {
    bucketName: "ip-attempts",
    dimension: "ip",
    identifier: rateLimitClientId(ipResult),
  };
}

/**
 * Buckets that only count failures and are refunded on success. A trusted
 * device skips the subnet/global budgets, which anyone can exhaust to lock the
 * owner out, and gets its own instead so a stolen cookie cannot brute force.
 */
function failureTargets(
  ipResult: Extract<ClientIpResolution, { ok: true }>,
  trustedDeviceId: string | null | undefined,
): RateLimitTarget[] {
  if (trustedDeviceId) {
    return [
      {
        bucketName: "device-attempts",
        dimension: "device",
        identifier: trustedDeviceId,
      },
    ];
  }
  return [
    {
      bucketName: "subnet-attempts",
      dimension: "subnet",
      identifier: ipResult.subnet,
    },
    { bucketName: "global-attempts", dimension: "global", identifier: "all" },
  ];
}

export type AdminLoginCheckResult =
  | { ok: true; ip?: string; subnet?: string }
  | {
      ok: false;
      status: 429 | 503;
      retryAfterSeconds: number;
      message: string;
    };

/**
 * Checks admin login attempts against IP, subnet, and global rate limits
 * before expensive password verification or database lookups.
 *
 * Buckets are consumed narrow → broad: once an IP is blocked its extra
 * attempts no longer reach the subnet/global buckets, so one client cannot
 * lock the owner out everywhere. The subnet/global units consumed here are
 * refunded by `resetAdminLoginRateLimit()` on success, so those shared
 * budgets only count failed logins (distributed brute force).
 */
export async function checkAdminLoginRateLimit(
  request: Request,
  opts?: AdminLoginGuardOptions | RateLimiter,
): Promise<AdminLoginCheckResult> {
  const options: AdminLoginGuardOptions =
    opts && "check" in opts ? { limiter: opts } : (opts ?? {});

  const isProd = options.isProduction ?? process.env.NODE_ENV === "production";

  const ipResult = resolveTrustedClientIp(request, {
    mode: options.proxyMode,
    customHeader: options.customHeader,
    isProduction: isProd,
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
  const decision = await limiter.check(POLICIES.adminLogin, [
    ipTarget(ipResult),
    ...failureTargets(ipResult, options.trustedDeviceId),
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

export async function resetAdminLoginRateLimit(
  request: Request,
  opts?: AdminLoginGuardOptions | RateLimiter,
): Promise<void> {
  const options: AdminLoginGuardOptions =
    opts && "check" in opts ? { limiter: opts } : (opts ?? {});

  const ipResult = resolveTrustedClientIp(request, {
    mode: options.proxyMode,
    customHeader: options.customHeader,
    isProduction: options.isProduction,
  });

  if (!ipResult.ok) return;

  const limiter = getLimiter(options.limiter);
  if (typeof limiter.reset === "function") {
    await limiter.reset(POLICIES.adminLogin, ipTarget(ipResult));
  }
  if (typeof limiter.release === "function") {
    await limiter.release(
      POLICIES.adminLogin,
      failureTargets(ipResult, options.trustedDeviceId),
    );
  }
}

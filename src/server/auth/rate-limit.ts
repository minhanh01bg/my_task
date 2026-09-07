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
 */
export async function checkAdminLoginRateLimit(
  request: Request,
  opts?: AdminLoginGuardOptions | RateLimiter,
): Promise<AdminLoginCheckResult> {
  const options: AdminLoginGuardOptions =
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
  const decision = await limiter.check(POLICIES.adminLogin, [
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

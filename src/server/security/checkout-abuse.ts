import { resolveTrustedClientIp } from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/security/rate-limit";
import { POLICIES } from "@/server/security/rate-limit-policy";
import type { OnlineCheckoutInput } from "@/types/online-order";

import type { TrustedProxyMode } from "@/server/http/client-ip";

export interface CheckoutAbuseGuardOptions {
  limiter?: RateLimiter;
  isProduction?: boolean;
  proxyMode?: TrustedProxyMode;
  customHeader?: string;
  challengeEnabled?: boolean;
  verifyChallenge?: (token: string) => Promise<boolean>;
}

export type PreParseAbuseResult =
  | { ok: true; clientIp: string; subnet: string }
  | {
      ok: false;
      status: 429 | 503;
      error: "rate_limited" | "untrusted_ip" | "limiter_unavailable";
      retryAfterSeconds?: number;
      message: string;
    };

export type PostParseAbuseResult =
  | { ok: true }
  | {
      ok: false;
      status: 403 | 429 | 503;
      error:
        | "rate_limited"
        | "challenge_required"
        | "challenge_failed"
        | "limiter_unavailable";
      retryAfterSeconds?: number;
      message: string;
    };

let defaultLimiter: RateLimiter | null = null;
export function setCheckoutAbuseLimiter(limiter: RateLimiter | null): void {
  defaultLimiter = limiter;
}

function getLimiter(injected?: RateLimiter): RateLimiter {
  if (injected) return injected;
  if (!defaultLimiter) {
    defaultLimiter = createRateLimiter();
  }
  return defaultLimiter;
}

/**
 * Layer 1: Cheap IP/Subnet/Global burst check before body stream reading or JSON parsing.
 */
export async function checkPreParseAbuse(
  request: Request,
  options?: CheckoutAbuseGuardOptions,
): Promise<PreParseAbuseResult> {
  const ipResolution = resolveTrustedClientIp(request, {
    mode: options?.proxyMode,
    customHeader: options?.customHeader,
    isProduction: options?.isProduction,
  });

  if (!ipResolution.ok) {
    return {
      ok: false,
      status: 503,
      error: "untrusted_ip",
      message: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.",
    };
  }

  const limiter = getLimiter(options?.limiter);
  const decision = await limiter.check(POLICIES.checkoutIp, [
    {
      bucketName: "ip-burst",
      dimension: "ip",
      identifier: ipResolution.ip,
    },
    {
      bucketName: "subnet-burst",
      dimension: "subnet",
      identifier: ipResolution.subnet,
    },
    {
      bucketName: "global-burst",
      dimension: "global",
      identifier: "global",
    },
  ]);

  if (!decision.allowed) {
    if (decision.reason === "limiter_unavailable") {
      return {
        ok: false,
        status: 503,
        error: "limiter_unavailable",
        retryAfterSeconds: decision.retryAfterSeconds,
        message: "Hệ thống đang bận. Vui lòng thử lại sau.",
      };
    }

    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      retryAfterSeconds: decision.retryAfterSeconds,
      message: "Quá nhiều yêu cầu. Vui lòng thử lại sau.",
    };
  }

  return {
    ok: true,
    clientIp: ipResolution.ip,
    subnet: ipResolution.subnet,
  };
}

/**
 * Layer 2: Post-parse velocity check on phone number and product IDs after schema validation.
 */
export async function checkPostParseAbuse(
  orderData: OnlineCheckoutInput,
  request: Request,
  options?: CheckoutAbuseGuardOptions,
): Promise<PostParseAbuseResult> {
  // 1. Adaptive security challenge check
  if (options?.challengeEnabled) {
    const challengeToken =
      request.headers.get("cf-turnstile-response") ||
      request.headers.get("x-challenge-token");

    if (!challengeToken) {
      return {
        ok: false,
        status: 403,
        error: "challenge_required",
        message: "Yêu cầu xác minh bảo mật để tiếp tục đặt hàng",
      };
    }

    const isValid = options.verifyChallenge
      ? await options.verifyChallenge(challengeToken)
      : challengeToken.length > 10;

    if (!isValid) {
      return {
        ok: false,
        status: 403,
        error: "challenge_failed",
        message: "Xác minh bảo mật thất bại",
      };
    }
  }

  const limiter = getLimiter(options?.limiter);

  // 2. Check phone velocity
  const phoneDecision = await limiter.check(POLICIES.checkoutPhone, [
    {
      bucketName: "phone-hourly",
      dimension: "phone",
      identifier: orderData.contactPhone,
    },
  ]);

  if (!phoneDecision.allowed) {
    if (phoneDecision.reason === "limiter_unavailable") {
      return {
        ok: false,
        status: 503,
        error: "limiter_unavailable",
        retryAfterSeconds: phoneDecision.retryAfterSeconds,
        message: "Hệ thống đang bận. Vui lòng thử lại sau.",
      };
    }
    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      retryAfterSeconds: phoneDecision.retryAfterSeconds,
      message: "Quá nhiều đơn hàng từ số điện thoại này trong thời gian ngắn",
    };
  }

  // 3. Check product velocity for lines
  const productTargets = orderData.lines.map((line) => ({
    bucketName: "product-velocity",
    dimension: "product",
    identifier: line.productId,
  }));

  const productDecision = await limiter.check(
    POLICIES.checkoutProduct,
    productTargets,
  );

  if (!productDecision.allowed) {
    if (productDecision.reason === "limiter_unavailable") {
      return {
        ok: false,
        status: 503,
        error: "limiter_unavailable",
        retryAfterSeconds: productDecision.retryAfterSeconds,
        message: "Hệ thống đang bận. Vui lòng thử lại sau.",
      };
    }
    return {
      ok: false,
      status: 429,
      error: "rate_limited",
      retryAfterSeconds: productDecision.retryAfterSeconds,
      message:
        "Sản phẩm đang có quá nhiều lượt mua cùng lúc. Vui lòng thử lại.",
    };
  }

  return { ok: true };
}

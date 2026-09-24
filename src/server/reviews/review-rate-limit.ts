import { resolveTrustedClientIp } from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitTarget,
} from "@/server/security/rate-limit";
import { POLICIES } from "@/server/security/rate-limit-policy";

let limiter: RateLimiter | null = null;

/** Cho test thay limiter; `null` quay ve limiter mac dinh. */
export function setReviewRateLimiter(next: RateLimiter | null): void {
  limiter = next;
}

/**
 * Policy `productReview`: 5 danh gia/tai khoan/24h + burst theo IP.
 * Tra so giay can cho khi bi chan, `null` khi duoc phep.
 */
export async function checkReviewRateLimit(
  request: Request,
  accountId: string,
): Promise<number | null> {
  const targets: RateLimitTarget[] = [
    {
      bucketName: "account-daily",
      dimension: "account",
      identifier: accountId,
    },
  ];
  const ip = resolveTrustedClientIp(request);
  if (ip.ok) {
    targets.push({
      bucketName: "ip-burst",
      dimension: "ip",
      identifier: ip.ip,
    });
  }
  limiter ??= createRateLimiter();
  const decision = await limiter.check(POLICIES.productReview, targets);
  return decision.allowed ? null : decision.retryAfterSeconds;
}

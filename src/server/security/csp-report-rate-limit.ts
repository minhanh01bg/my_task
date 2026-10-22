import { resolveTrustedClientIp } from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitTarget,
} from "@/server/security/rate-limit";
import type { RateLimitPolicy } from "@/server/security/rate-limit-policy";

/**
 * Báo cáo CSP chỉ để ghi log: fail-open, timeout ngắn để không làm chậm trình
 * duyệt. Một trang lỗi có thể bắn vài báo cáo mỗi lần tải nên hạn mức theo IP
 * khá rộng; request không xác định được IP dùng chung một bucket nhỏ.
 */
export const CSP_REPORT_POLICY: RateLimitPolicy = {
  name: "csp-report",
  failClosed: false,
  timeoutMs: 500,
  buckets: [
    { name: "ip-reports", limit: 60, windowSeconds: 60 },
    { name: "unresolved-ip-reports", limit: 60, windowSeconds: 60 },
    { name: "global-reports", limit: 3000, windowSeconds: 60 },
  ],
};

let limiter: RateLimiter | null = null;

/** Cho test thay limiter; `null` quay về limiter mặc định. */
export function setCspReportRateLimiter(next: RateLimiter | null): void {
  limiter = next;
}

/**
 * Trả số giây cần chờ khi IP vượt hạn mức, `null` khi được phép (kể cả khi
 * limiter lỗi — mất vài báo cáo CSP không đáng để chặn).
 */
export async function checkCspReportRateLimit(
  request: Request,
): Promise<number | null> {
  const ip = resolveTrustedClientIp(request);
  const targets: RateLimitTarget[] = [
    ip.ok
      ? { bucketName: "ip-reports", dimension: "ip", identifier: ip.ip }
      : {
          bucketName: "unresolved-ip-reports",
          dimension: "global",
          identifier: "unresolved-ip",
        },
    { bucketName: "global-reports", dimension: "global", identifier: "global" },
  ];
  try {
    limiter ??= createRateLimiter();
    const decision = await limiter.check(CSP_REPORT_POLICY, targets);
    return decision.allowed || decision.reason === "limiter_unavailable"
      ? null
      : decision.retryAfterSeconds;
  } catch {
    return null;
  }
}

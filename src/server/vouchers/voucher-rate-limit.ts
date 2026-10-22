import { resolveTrustedClientIp } from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
} from "@/server/security/rate-limit";
import { POLICIES } from "@/server/security/rate-limit-policy";

let limiter: RateLimiter | null = null;

/** Cho test thay limiter; `null` quay về limiter mặc định. */
export function setVoucherRateLimiter(next: RateLimiter | null): void {
  limiter = next;
}

/**
 * Chống dò mã theo IP: dùng lại policy tra cứu công khai `receiptLookup`
 * (fail-open — đơn hàng vẫn kiểm tra lại voucher phía server).
 * Không xác định được IP thì mọi request dùng chung bucket dự phòng
 * `voucherUnresolvedIp` (fail-closed) thay vì bỏ qua giới hạn.
 * Trả số giây cần chờ khi bị chặn, `null` khi được phép.
 */
export async function checkVoucherRateLimit(
  request: Request,
): Promise<number | null> {
  const ip = resolveTrustedClientIp(request);
  limiter ??= createRateLimiter();
  const decision = ip.ok
    ? await limiter.check(POLICIES.receiptLookup, [
        { bucketName: "ip-misses", dimension: "ip", identifier: ip.ip },
        {
          bucketName: "subnet-misses",
          dimension: "subnet",
          identifier: ip.subnet,
        },
      ])
    : await limiter.check(POLICIES.voucherUnresolvedIp, [
        {
          bucketName: "global-misses",
          dimension: "global",
          identifier: "unresolved-ip",
        },
      ]);
  return decision.allowed ? null : decision.retryAfterSeconds;
}

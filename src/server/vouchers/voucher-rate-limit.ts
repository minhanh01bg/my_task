import {
  rateLimitClientId,
  resolveTrustedClientIp,
} from "@/server/http/client-ip";
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitTarget,
} from "@/server/security/rate-limit";
import {
  POLICIES,
  type RateLimitPolicy,
} from "@/server/security/rate-limit-policy";

/** Câu trả về cùng 429 ở API kiểm tra mã và ở checkout. */
export const VOUCHER_RATE_LIMIT_MESSAGE =
  "Bạn thử mã quá nhiều lần. Vui lòng thử lại sau.";

let limiter: RateLimiter | null = null;

/** Cho test thay limiter; `null` quay về limiter mặc định. */
export function setVoucherRateLimiter(next: RateLimiter | null): void {
  limiter = next;
}

/**
 * Chống dò mã theo client (`rateLimitClientId`: IPv4 theo địa chỉ, IPv6 theo
 * /64) bằng policy riêng `voucherCheck` (fail-open — đơn hàng vẫn kiểm tra lại
 * voucher phía server), không chung bộ đếm với tra cứu biên nhận nên dò hết
 * lượt mã không khoá khách xem biên nhận. Không xác định được IP thì mọi
 * request dùng chung bucket dự phòng `voucherUnresolvedIp` (fail-closed) thay
 * vì bỏ qua giới hạn.
 */
function voucherBuckets(request: Request): {
  policy: RateLimitPolicy;
  targets: RateLimitTarget[];
} {
  const ip = resolveTrustedClientIp(request);
  if (!ip.ok) {
    return {
      policy: POLICIES.voucherUnresolvedIp,
      targets: [
        {
          bucketName: "global-misses",
          dimension: "global",
          identifier: "unresolved-ip",
        },
      ],
    };
  }
  return {
    policy: POLICIES.voucherCheck,
    targets: [
      {
        bucketName: "ip-misses",
        dimension: "ip",
        identifier: rateLimitClientId(ip),
      },
      {
        bucketName: "subnet-misses",
        dimension: "subnet",
        identifier: ip.subnet,
      },
    ],
  };
}

/** Trả số giây cần chờ khi bị chặn, `null` khi được phép (đã tính một lượt). */
export async function checkVoucherRateLimit(
  request: Request,
): Promise<number | null> {
  const { policy, targets } = voucherBuckets(request);
  limiter ??= createRateLimiter();
  const decision = await limiter.check(policy, targets);
  return decision.allowed ? null : decision.retryAfterSeconds;
}

/**
 * Hoàn lượt mà `checkVoucherRateLimit` vừa tính (best-effort). Checkout tính
 * trước rồi hoàn khi voucher không bị từ chối, nên chỉ lần dùng mã sai mới
 * trừ vào hạn mức.
 */
export async function refundVoucherAttempt(request: Request): Promise<void> {
  const { policy, targets } = voucherBuckets(request);
  limiter ??= createRateLimiter();
  await limiter.release?.(policy, targets);
}

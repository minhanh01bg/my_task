import { env } from "@/config/env";
import { verifyPassword } from "@/server/auth/session";
import {
  createRateLimiter,
  type RateLimiter,
  type RateLimitTarget,
} from "@/server/security/rate-limit";
import type { RateLimitPolicy } from "@/server/security/rate-limit-policy";

/**
 * Nhap sai mat khau chu: 5 lan / 15 phut moi danh tinh admin, 20 lan toan he
 * thong. Lan nhap dung duoc hoan lai nen chi lan sai bi dem. Fail-closed:
 * limiter loi thi khong cho doi tai khoan nhan tien.
 */
export const OWNER_PASSWORD_POLICY = {
  name: "owner-password",
  failClosed: true,
  timeoutMs: 1500,
  buckets: [
    { name: "identity-failures", limit: 5, windowSeconds: 900 },
    { name: "global-failures", limit: 20, windowSeconds: 900 },
  ],
} as const satisfies RateLimitPolicy;

let defaultLimiter: RateLimiter | null = null;

export function setOwnerPasswordLimiter(limiter: RateLimiter | null): void {
  defaultLimiter = limiter;
}

function getLimiter(): RateLimiter {
  if (!defaultLimiter) defaultLimiter = createRateLimiter();
  return defaultLimiter;
}

export type OwnerPasswordCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_configured"
        | "missing"
        | "invalid"
        | "rate_limited"
        | "limiter_unavailable";
      message: string;
    };

/**
 * Xac minh mat khau chu cua hang (OWNER_PASSWORD_HASH) truoc thao tac doi tai
 * khoan nhan tien. Chua cau hinh thi luon tu choi. So sanh hash bang
 * `verifyPassword` (thoi gian hang so); khong bao gio ghi log mat khau.
 */
export async function verifyOwnerPassword(
  password: string | undefined,
  identityId: string | undefined,
): Promise<OwnerPasswordCheck> {
  const hash = env.OWNER_PASSWORD_HASH;
  if (!hash) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "Chưa cấu hình mật khẩu chủ cửa hàng (OWNER_PASSWORD_HASH) nên không thể đổi tài khoản nhận tiền.",
    };
  }
  if (!password) {
    return {
      ok: false,
      reason: "missing",
      message: "Nhập mật khẩu chủ cửa hàng để đổi tài khoản nhận tiền.",
    };
  }

  const limiter = getLimiter();
  const targets: RateLimitTarget[] = [
    {
      bucketName: "identity-failures",
      dimension: "admin",
      identifier: identityId ?? "unknown",
    },
    { bucketName: "global-failures", dimension: "global", identifier: "all" },
  ];
  const decision = await limiter.check(OWNER_PASSWORD_POLICY, targets);
  if (!decision.allowed) {
    return decision.reason === "limiter_unavailable"
      ? {
          ok: false,
          reason: "limiter_unavailable",
          message: "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.",
        }
      : {
          ok: false,
          reason: "rate_limited",
          message: "Nhập sai mật khẩu chủ quá nhiều lần. Vui lòng thử lại sau.",
        };
  }

  if (!(await verifyPassword(password, hash))) {
    return {
      ok: false,
      reason: "invalid",
      message: "Mật khẩu chủ cửa hàng không đúng.",
    };
  }

  await limiter.release?.(OWNER_PASSWORD_POLICY, targets);
  return { ok: true };
}

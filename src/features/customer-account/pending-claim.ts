/**
 * Đơn khách đang chờ lưu vào tài khoản sau khi đăng nhập. Token đơn là khoá
 * truy cập nên được giữ trong sessionStorage của tab thay vì đưa vào
 * `/account/login?next=...`, nơi nó lọt vào log, Sentry và lịch sử duyệt.
 */
export const PENDING_CLAIM_KEY = "an-phat-pending-claim";

const PENDING_CLAIM_TTL_MS = 30 * 60_000;
const GUEST_TOKEN_REGEX = /^[A-Za-z0-9_-]+$/;

/** Trả về false khi trình duyệt chặn sessionStorage. */
export function rememberPendingClaim(token: string): boolean {
  try {
    sessionStorage.setItem(
      PENDING_CLAIM_KEY,
      JSON.stringify({ token, savedAt: Date.now() }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Lấy (và xoá) đường dẫn đơn khách đang chờ lưu, nếu còn hạn. */
export function takePendingClaimPath(): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CLAIM_KEY);
    sessionStorage.removeItem(PENDING_CLAIM_KEY);
    if (!raw) return null;
    const { token, savedAt } = JSON.parse(raw) as {
      token?: unknown;
      savedAt?: unknown;
    };
    const age = Date.now() - Number(savedAt);
    if (
      typeof token !== "string" ||
      !GUEST_TOKEN_REGEX.test(token) ||
      !(age >= 0 && age <= PENDING_CLAIM_TTL_MS)
    ) {
      return null;
    }
    return `/orders/guest/${token}`;
  } catch {
    return null;
  }
}

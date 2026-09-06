import { createHash } from "node:crypto";

const attempts = new Map<string, { count: number; resetAt: number }>();

export function rateLimitKey(ip: string, phone: string): string {
  return createHash("sha256").update(`${ip}|${phone}`).digest("hex");
}

export function consumeCustomerAuthAttempt(
  key: string,
  now = Date.now(),
): boolean {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
    return true;
  }
  if (current.count >= 10) return false;
  current.count += 1;
  return true;
}

export function getRequestIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  );
}

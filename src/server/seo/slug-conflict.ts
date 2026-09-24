import { Prisma } from "@prisma/client";

const MAX_SLUG_ATTEMPTS = 3;

/** P2002 trên cột `slug` (hai lần lưu cùng lúc chọn cùng một ứng viên). */
export function isSlugConflict(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }
  const target = error.meta?.target;
  const matches = (value: unknown): boolean =>
    typeof value === "string" &&
    (value === "slug" || value.endsWith("_slug_key"));
  return Array.isArray(target) ? target.some(matches) : matches(target);
}

/**
 * Chạy lại `write` (tự chọn slug mới mỗi lần) khi đụng unique slug. Lỗi
 * unique khác (vd. SKU) và lỗi còn lại được ném nguyên vẹn.
 */
export async function retryOnSlugConflict<T>(
  write: () => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await write();
    } catch (error: unknown) {
      if (attempt >= MAX_SLUG_ATTEMPTS || !isSlugConflict(error)) throw error;
    }
  }
}

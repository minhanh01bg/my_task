/**
 * Slug URL SEO: bỏ dấu tiếng Việt (đ→d), chữ thường, mọi cụm ký tự ngoài
 * a-z0-9 thành một dấu `-`, tối đa `SLUG_MAX_LENGTH` ký tự. Thuần, không đọc DB.
 */

export const SLUG_MAX_LENGTH = 80;

const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
}

/** Ứng viên thứ `n`: 1 → `base`, 2 → `base-2`... (cắt gốc để vừa giới hạn). */
export function slugCandidate(base: string, n: number): string {
  if (n <= 1) return base;
  const suffix = `-${n}`;
  const head = base
    .slice(0, SLUG_MAX_LENGTH - suffix.length)
    .replace(/-+$/g, "");
  return `${head}${suffix}`;
}

/** Ứng viên nhỏ nhất chưa có trong `taken`. */
export function pickUniqueSlug(
  base: string,
  taken: ReadonlySet<string>,
): string {
  for (let n = 1; ; n += 1) {
    const candidate = slugCandidate(base, n);
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Tiền tố chung của mọi ứng viên (tới hậu tố `-99999999`): một truy vấn
 * `startsWith` lấy hết slug có thể đụng.
 */
export function slugLookupPrefix(base: string): string {
  return base.slice(0, SLUG_MAX_LENGTH - 9).replace(/-+$/g, "");
}

/**
 * Sinh slug duy nhất từ `name`. `findTaken(prefix)` trả các slug đang dùng
 * bắt đầu bằng `prefix` (đã loại chính bản ghi đang sửa).
 */
export async function resolveUniqueSlug(
  name: string,
  fallback: string,
  findTaken: (prefix: string) => Promise<string[]>,
): Promise<string> {
  const base = slugify(name) || fallback;
  const taken = await findTaken(slugLookupPrefix(base));
  return pickUniqueSlug(base, new Set(taken));
}

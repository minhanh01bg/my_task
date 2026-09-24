import type { PrismaClient } from "@prisma/client";

import { resolveUniqueSlug } from "@/lib/seo/slugify";

export const PRODUCT_SLUG_FALLBACK = "san-pham";

type ProductSlugDb = Pick<PrismaClient, "product">;

/** Slug đang dùng bắt đầu bằng `prefix`, trừ sản phẩm `excludeId`. */
export async function findTakenProductSlugs(
  db: ProductSlugDb,
  prefix: string,
  excludeId?: string,
): Promise<string[]> {
  const rows = await db.product.findMany({
    where: {
      slug: { startsWith: prefix },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { slug: true },
  });
  return rows.flatMap((row) => (row.slug ? [row.slug] : []));
}

/**
 * Slug cho lần lưu: giữ nguyên slug đã có (URL ổn định, không đổi khi đổi
 * tên); chỉ sinh mới khi bản ghi chưa từng có slug (tạo mới hoặc bản ghi cũ
 * chưa có slug).
 */
export async function resolveProductSlug(
  db: ProductSlugDb,
  input: { id?: string; name: string },
): Promise<string> {
  if (input.id) {
    const existing = await db.product.findUnique({
      where: { id: input.id },
      select: { slug: true },
    });
    if (existing?.slug) return existing.slug;
  }
  return resolveUniqueSlug(input.name, PRODUCT_SLUG_FALLBACK, (prefix) =>
    findTakenProductSlugs(db, prefix, input.id),
  );
}

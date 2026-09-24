import type { PrismaClient } from "@prisma/client";

import { resolveUniqueSlug } from "@/lib/seo/slugify";

export const CATEGORY_SLUG_FALLBACK = "danh-muc";

type CategorySlugDb = Pick<PrismaClient, "category">;

/** Slug đang dùng bắt đầu bằng `prefix`, trừ danh mục `excludeId`. */
export async function findTakenCategorySlugs(
  db: CategorySlugDb,
  prefix: string,
  excludeId?: string,
): Promise<string[]> {
  const rows = await db.category.findMany({
    where: {
      slug: { startsWith: prefix },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { slug: true },
  });
  return rows.flatMap((row) => (row.slug ? [row.slug] : []));
}

/**
 * Cùng quy tắc với sản phẩm: giữ nguyên slug đã có (không đổi khi đổi tên);
 * chỉ sinh mới khi bản ghi chưa từng có slug.
 */
export async function resolveCategorySlug(
  db: CategorySlugDb,
  input: { id?: string; name: string },
): Promise<string> {
  if (input.id) {
    const existing = await db.category.findUnique({
      where: { id: input.id },
      select: { slug: true },
    });
    if (existing?.slug) return existing.slug;
  }
  return resolveUniqueSlug(input.name, CATEGORY_SLUG_FALLBACK, (prefix) =>
    findTakenCategorySlugs(db, prefix, input.id),
  );
}

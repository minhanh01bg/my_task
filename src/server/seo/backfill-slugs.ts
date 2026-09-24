import type { PrismaClient } from "@prisma/client";

import { pickUniqueSlug, slugify } from "@/lib/seo/slugify";
import { CATEGORY_SLUG_FALLBACK } from "@/server/categories/category-slug";
import { PRODUCT_SLUG_FALLBACK } from "@/server/products/product-slug";

export interface BackfillSlugsResult {
  products: number;
  categories: number;
}

const UPDATE_CHUNK = 100;

interface SlugRow {
  id: string;
  name: string;
}

/** Gán slug trong bộ nhớ theo đúng quy tắc của saveProduct (hậu tố -2, -3). */
function assignSlugs(
  rows: SlugRow[],
  existing: Array<{ slug: string | null }>,
  fallback: string,
): Array<{ id: string; slug: string }> {
  const taken = new Set(
    existing.flatMap((row) => (row.slug ? [row.slug] : [])),
  );
  return rows.map((row) => {
    const slug = pickUniqueSlug(slugify(row.name) || fallback, taken);
    taken.add(slug);
    return { id: row.id, slug };
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Gán slug cho sản phẩm (chưa xoá) và danh mục còn thiếu. Idempotent: lần
 * chạy sau không còn dòng `slug = null` nên trả 0. Chỉ ghi cột `slug` nên
 * không cần đi qua saveProduct (searchText không đổi).
 */
export async function backfillSlugs(
  db: PrismaClient,
): Promise<BackfillSlugsResult> {
  const [productSlugs, products, categorySlugs, categories] = await Promise.all(
    [
      db.product.findMany({
        where: { slug: { not: null } },
        select: { slug: true },
      }),
      db.product.findMany({
        where: { slug: null, deletedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
      db.category.findMany({
        where: { slug: { not: null } },
        select: { slug: true },
      }),
      db.category.findMany({
        where: { slug: null },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      }),
    ],
  );

  const productUpdates = assignSlugs(
    products,
    productSlugs,
    PRODUCT_SLUG_FALLBACK,
  );
  const categoryUpdates = assignSlugs(
    categories,
    categorySlugs,
    CATEGORY_SLUG_FALLBACK,
  );

  for (const part of chunk(productUpdates, UPDATE_CHUNK)) {
    await db.$transaction(
      part.map(({ id, slug }) =>
        db.product.update({ where: { id }, data: { slug } }),
      ),
    );
  }
  for (const part of chunk(categoryUpdates, UPDATE_CHUNK)) {
    await db.$transaction(
      part.map(({ id, slug }) =>
        db.category.update({ where: { id }, data: { slug } }),
      ),
    );
  }

  return {
    products: productUpdates.length,
    categories: categoryUpdates.length,
  };
}

import { buildSearchText } from "@/lib/search/search-text";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import { retryOnSlugConflict } from "@/server/seo/slug-conflict";

import { resolveProductSlug } from "./product-slug";

export interface SaveProductInput {
  id?: string;
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  unit: string;
  price: number;
  costPrice: number;
  stock: number;
  aliases?: string | null;
  imageUrl?: string | null;
  isActive: boolean;
}

/**
 * Noi duy nhat duoc phep ghi san pham — vi searchText phai duoc sinh lai moi
 * lan luu, con slug thi giu nguyen khi da co (chi sinh moi cho ban ghi chua
 * tung co slug) de URL on dinh khi doi ten. Sua san pham bang duong khac se
 * lam tim kiem sai va co the lam sai quy tac giu slug.
 */
export async function saveProduct(
  input: SaveProductInput,
): Promise<{ id: string }> {
  const category = input.categoryId
    ? await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { name: true },
      })
    : null;

  const data = {
    name: input.name,
    sku: input.sku || null,
    categoryId: input.categoryId || null,
    unit: input.unit,
    price: Math.round(input.price),
    costPrice: Math.round(input.costPrice),
    stock: input.stock,
    aliases: input.aliases || null,
    isActive: input.isActive,
    searchText: buildSearchText({
      name: input.name,
      aliases: input.aliases,
      sku: input.sku,
      categoryName: category?.name ?? null,
    }),
  };

  const dataWithImage =
    input.imageUrl === undefined
      ? data
      : { ...data, imageUrl: input.imageUrl || null };

  // Hai lan luu cung luc co the chon cung slug: chon lai (unique index chan).
  const saved = await retryOnSlugConflict(async () => {
    const slug = await resolveProductSlug(prisma, {
      id: input.id,
      name: input.name,
    });
    const withSlug = { ...dataWithImage, slug };
    return input.id
      ? prisma.product.update({
          where: { id: input.id },
          data: withSlug,
          select: { id: true },
        })
      : prisma.product.create({ data: withSlug, select: { id: true } });
  });

  revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.product(saved.id));
  return saved;
}

/**
 * Xoa mem — don cu van tham chieu duoc san pham, nhung POS khong hien nua.
 */
export async function softDeleteProduct(id: string): Promise<void> {
  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.product(id));
}

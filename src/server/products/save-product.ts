import { buildSearchText } from "@/lib/search/search-text";
import { prisma } from "@/server/db/prisma";

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
 * Noi duy nhat duoc phep ghi san pham — vi searchText PHAI duoc sinh lai
 * moi lan luu. Sua san pham bang duong khac se lam tim kiem sai.
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

  if (input.id) {
    const updated = await prisma.product.update({
      where: { id: input.id },
      data: dataWithImage,
      select: { id: true },
    });
    return updated;
  }

  const created = await prisma.product.create({
    data: dataWithImage,
    select: { id: true },
  });
  return created;
}

/**
 * Xoa mem — don cu van tham chieu duoc san pham, nhung POS khong hien nua.
 */
export async function softDeleteProduct(id: string): Promise<void> {
  await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

import type { Prisma } from "@prisma/client";

import { buildSearchText } from "@/lib/search/search-text";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import { retryOnSlugConflict } from "@/server/seo/slug-conflict";

import { resolveProductSlug } from "./product-slug";

export const PRODUCT_STOCK_CONFLICT_MESSAGE =
  "Tồn kho đã thay đổi (có đơn mới). Vui lòng tải lại trang rồi sửa lại.";

/** Tồn kho trong DB đã khác số form đã tải (có đơn mới): không ghi gì. */
export class ProductStockConflictError extends Error {
  constructor() {
    super(PRODUCT_STOCK_CONFLICT_MESSAGE);
    this.name = "ProductStockConflictError";
  }
}

export interface StockChange {
  previousStock: number;
  stock: number;
  delta: number;
}

export interface SaveProductInput {
  id?: string;
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  unit: string;
  price: number;
  costPrice: number;
  /** Tạo mới: tồn kho ban đầu. Sửa: chỉ ghi khi khác `originalStock`. */
  stock: number;
  /** Sửa: tồn kho lúc form được tải; bỏ trống thì không đụng cột tồn kho. */
  originalStock?: number;
  aliases?: string | null;
  imageUrl?: string | null;
  /** Bỏ trống khi sửa để giữ trạng thái đang bán/đang ẩn. */
  isActive?: boolean;
}

/**
 * Ghi tồn kho mới chỉ khi DB vẫn đúng số `from` form đã tải (so-và-ghi), kèm
 * phiếu `adjust`. Không dòng nào khớp nghĩa là đơn/điều chỉnh khác đã chen
 * vào: ném lỗi để transaction huỷ mọi thay đổi.
 */
async function applyStockAdjustment(
  tx: Prisma.TransactionClient,
  productId: string,
  from: number,
  to: number,
): Promise<StockChange> {
  const { count } = await tx.product.updateMany({
    where: { id: productId, stock: from },
    data: { stock: to },
  });
  if (count === 0) throw new ProductStockConflictError();
  const delta = to - from;
  await tx.stockMovement.create({
    data: { productId, delta, reason: "adjust" },
  });
  return { previousStock: from, stock: to, delta };
}

/**
 * Noi duy nhat duoc phep ghi san pham — vi searchText phai duoc sinh lai moi
 * lan luu, con slug thi giu nguyen khi da co (chi sinh moi cho ban ghi chua
 * tung co slug) de URL on dinh khi doi ten. Sua san pham bang duong khac se
 * lam tim kiem sai va co the lam sai quy tac giu slug.
 */
export async function saveProduct(
  input: SaveProductInput,
): Promise<{ id: string; stockChange: StockChange | null }> {
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
    aliases: input.aliases || null,
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
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

  const { id, originalStock } = input;

  // Hai lan luu cung luc co the chon cung slug: chon lai (unique index chan).
  const saved = await retryOnSlugConflict(async () => {
    if (!id) {
      const slug = await resolveProductSlug(prisma, { name: input.name });
      const created = await prisma.product.create({
        data: {
          ...dataWithImage,
          stock: input.stock,
          isActive: input.isActive ?? true,
          slug,
        },
        select: { id: true },
      });
      return { id: created.id, stockChange: null };
    }

    // Sua: khong ghi lai so ton kho form da tai (co the da ban bot tu luc mo).
    return prisma.$transaction(async (tx) => {
      const slug = await resolveProductSlug(tx, { id, name: input.name });
      await tx.product.update({
        where: { id },
        data: { ...dataWithImage, slug },
        select: { id: true },
      });
      const stockChange =
        originalStock === undefined || input.stock === originalStock
          ? null
          : await applyStockAdjustment(tx, id, originalStock, input.stock);
      return { id, stockChange };
    });
  });

  revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.product(saved.id));
  return saved;
}

/**
 * Sua nhanh gia + ton kho tu bang san pham. Khong doi ten/danh muc nen
 * searchText giu nguyen; ton kho di qua cung buoc so-va-ghi voi saveProduct.
 */
export async function quickUpdateProduct(input: {
  id: string;
  price: number;
  stock: number;
  originalStock: number;
}): Promise<{ stockChange: StockChange | null }> {
  const stockChange = await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id: input.id, deletedAt: null },
      data: { price: Math.round(input.price) },
      select: { id: true },
    });
    return input.stock === input.originalStock
      ? null
      : applyStockAdjustment(tx, input.id, input.originalStock, input.stock);
  });

  revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.product(input.id));
  return { stockChange };
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

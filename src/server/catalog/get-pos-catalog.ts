import { prisma } from "@/server/db/prisma";
import type { CatalogResponse } from "@/types/catalog";

/**
 * Tải toàn bộ danh mục và sản phẩm đang bán phục vụ máy bán hàng POS.
 * Được dùng đồng nhất giữa Server Component `/pos` và Route Handler `/api/catalog`.
 */
export async function getPosCatalog(): Promise<CatalogResponse> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        unit: true,
        stock: true,
        imageUrl: true,
        categoryId: true,
        soldCount: true,
        searchText: true,
      },
    }),
  ]);

  return {
    categories,
    products,
    fetchedAt: new Date().toISOString(),
  };
}

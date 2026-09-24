import type { OnlineProduct } from "@/features/online-store/types";
import { prisma } from "@/server/db/prisma";

/**
 * San pham cho ngan "Yêu thích": chi hang dang ban (khong xoa, khong dich vu),
 * giu dung thu tu danh sach cua khach. Id la/het ban bi bo qua am tham.
 */
export async function getWishlistProducts(
  ids: string[],
): Promise<OnlineProduct[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: {
      id: { in: ids },
      isActive: true,
      isService: false,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      unit: true,
      stock: true,
      imageUrl: true,
      categoryId: true,
      searchText: true,
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

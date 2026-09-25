import { prisma } from "@/server/db/prisma";

export interface CategoryWithProductCount {
  id: string;
  name: string;
  slug: string | null;
  sortOrder: number;
  _count: {
    products: number;
  };
}

/**
 * Lấy danh sách danh mục phục vụ trang quản trị, sắp xếp theo thứ tự hiển thị và đếm số sản phẩm.
 */
export async function listCategoriesWithProductCount(): Promise<
  CategoryWithProductCount[]
> {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
}

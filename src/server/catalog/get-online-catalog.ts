import type { OnlineCatalog } from "@/features/online-store/types";
import { prisma } from "@/server/db/prisma";

export async function getOnlineCatalog(): Promise<OnlineCatalog> {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            products: {
              where: { isActive: true, isService: false, deletedAt: null },
            },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true, isService: false, deletedAt: null },
      orderBy: [{ soldCount: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        price: true,
        unit: true,
        stock: true,
        imageUrl: true,
        categoryId: true,
        searchText: true,
        soldCount: true,
      },
    }),
  ]);

  return {
    categories: categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      productCount: cat._count.products,
    })),
    products,
  };
}

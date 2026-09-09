import type { OnlineProduct } from "@/features/online-store/types";
import { prisma } from "@/server/db/prisma";

export interface OnlineProductDetail {
  product: OnlineProduct & {
    sku: string | null;
    category: { id: string; name: string } | null;
  };
  relatedProducts: OnlineProduct[];
}

export async function getOnlineProductDetail(
  id: string,
): Promise<OnlineProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: {
      id,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      unit: true,
      stock: true,
      imageUrl: true,
      categoryId: true,
      searchText: true,
      soldCount: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!product) return null;

  let relatedProducts: OnlineProduct[] = [];
  if (product.categoryId) {
    relatedProducts = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        isActive: true,
        isService: false,
        deletedAt: null,
      },
      orderBy: [{ soldCount: "desc" }, { name: "asc" }],
      take: 4,
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
    });
  }

  return {
    product,
    relatedProducts,
  };
}

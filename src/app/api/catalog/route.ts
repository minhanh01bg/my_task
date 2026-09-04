import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";
import type { CatalogResponse } from "@/types/catalog";

/**
 * May ban tai TOAN BO danh muc mot lan luc mo ca roi tim kiem trong bo nho.
 * Vi vay endpoint nay tra ve tat ca san pham dang ban, khong phan trang.
 */
export async function GET() {
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
        categoryId: true,
        soldCount: true,
        imageUrl: true,
        searchText: true,
      },
    }),
  ]);

  const body: CatalogResponse = {
    categories,
    products,
    fetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(body);
}

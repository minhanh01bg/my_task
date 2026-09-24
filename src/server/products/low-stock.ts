import type { Prisma } from "@prisma/client";

import { PRODUCT_LOW_STOCK_THRESHOLD } from "@/server/admin/list-products";
import { prisma } from "@/server/db/prisma";

/**
 * Hang "sap het": con tu nguong tro xuong, gom ca ton am (can chinh kho gap).
 * Dung chung cho badge menu admin va trang tong quan de hai con so khop nhau.
 */
export const LOW_STOCK_WHERE = {
  deletedAt: null,
  isService: false,
  stock: { lte: PRODUCT_LOW_STOCK_THRESHOLD },
} satisfies Prisma.ProductWhereInput;

export async function countLowStock(): Promise<number> {
  return prisma.product.count({ where: LOW_STOCK_WHERE });
}

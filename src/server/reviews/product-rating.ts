import type { Prisma } from "@prisma/client";

import type { RatingSummary } from "@/types/review";

/**
 * Tinh lai `ratingAvg/ratingCount` cua san pham tu cac review `published`.
 * Chi goi BEN TRONG `$transaction` cung lan ghi review (pool 1 ket noi: dung
 * `tx`, khong dung `prisma`). Ghi thang cot aggregate — khong qua
 * `saveProduct()` vi day khong phai sua thong tin san pham.
 */
export async function recomputeProductRating(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<RatingSummary> {
  const aggregate = await tx.productReview.aggregate({
    where: { productId, status: "published" },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const count = aggregate._count._all;
  const avg =
    count > 0 ? Math.round((aggregate._avg.rating ?? 0) * 100) / 100 : 0;

  await tx.product.update({
    where: { id: productId },
    data: { ratingAvg: avg, ratingCount: count },
    select: { id: true },
  });
  return { avg, count };
}

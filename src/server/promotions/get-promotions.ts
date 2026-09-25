import type { StorefrontPromotion } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

/**
 * Lấy danh sách tất cả khuyến mãi & chiến dịch cửa hàng sắp xếp theo mức độ ưu tiên giảm dần.
 */
export async function listStorefrontPromotions(): Promise<
  StorefrontPromotion[]
> {
  return prisma.storefrontPromotion.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  });
}

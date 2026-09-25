import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { listStorefrontPromotions } from "@/server/promotions/get-promotions";

describe("listStorefrontPromotions", () => {
  beforeEach(async () => {
    await prisma.storefrontPromotion.deleteMany();
  });

  it("trả về danh sách khuyến mãi sắp xếp theo priority giảm dần", async () => {
    await prisma.storefrontPromotion.create({
      data: {
        title: "Khuyến mãi bình thường",
        placement: "announcement",
        priority: 1,
        isActive: true,
      },
    });

    await prisma.storefrontPromotion.create({
      data: {
        title: "Khuyến mãi VIP",
        placement: "hero",
        priority: 10,
        isActive: true,
      },
    });

    const promos = await listStorefrontPromotions();
    expect(promos).toHaveLength(2);
    expect(promos[0].title).toBe("Khuyến mãi VIP");
    expect(promos[0].priority).toBe(10);
    expect(promos[1].title).toBe("Khuyến mãi bình thường");
    expect(promos[1].priority).toBe(1);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { getActivePromotions } from "@/server/storefront/promotions";

describe("Storefront Promotions Server Service", () => {
  beforeEach(async () => {
    await prisma.storefrontPromotion.deleteMany();
  });

  it("chỉ trả về các chiến dịch đang active trong khoảng thời gian hiệu lực (UTC window)", async () => {
    const now = new Date("2026-09-08T12:00:00Z");

    // 1. Đang diễn ra
    await prisma.storefrontPromotion.create({
      data: {
        title: "Khuyến mãi tháng 9",
        placement: "announcement",
        isActive: true,
        startsAt: new Date("2026-09-01T00:00:00Z"),
        endsAt: new Date("2026-09-30T23:59:59Z"),
        priority: 10,
      },
    });

    // 2. Không giới hạn thời gian (luôn active)
    await prisma.storefrontPromotion.create({
      data: {
        title: "Ưu đãi thành viên mới",
        placement: "announcement",
        isActive: true,
        priority: 5,
      },
    });

    // 3. Đã hết hạn (quá khứ)
    await prisma.storefrontPromotion.create({
      data: {
        title: "Sale hè tháng 8",
        placement: "announcement",
        isActive: true,
        startsAt: new Date("2026-08-01T00:00:00Z"),
        endsAt: new Date("2026-08-31T23:59:59Z"),
        priority: 20,
      },
    });

    // 4. Chưa tới ngày bắt đầu (tương lai)
    await prisma.storefrontPromotion.create({
      data: {
        title: "Chiến dịch Tết",
        placement: "announcement",
        isActive: true,
        startsAt: new Date("2026-12-01T00:00:00Z"),
        endsAt: new Date("2026-12-31T23:59:59Z"),
        priority: 30,
      },
    });

    // 5. Bị tắt thủ công (isActive: false)
    await prisma.storefrontPromotion.create({
      data: {
        title: "Chiến dịch tạm ngưng",
        placement: "announcement",
        isActive: false,
        priority: 50,
      },
    });

    const active = await getActivePromotions({
      placement: "announcement",
      now,
    });

    expect(active.length).toBe(2);
    // Sắp xếp ưu tiên: priority cao hơn xếp trước
    expect(active[0].title).toBe("Khuyến mãi tháng 9");
    expect(active[1].title).toBe("Ưu đãi thành viên mới");
  });

  it("từ chối hoặc loại bỏ các campaign có CTA không an toàn (javascript:, data:)", async () => {
    const now = new Date("2026-09-08T12:00:00Z");

    await prisma.storefrontPromotion.create({
      data: {
        title: "Hacked link",
        placement: "announcement",
        isActive: true,
        ctaLabel: "Click me",
        ctaHref: "javascript:alert(1)",
        priority: 100,
      },
    });

    await prisma.storefrontPromotion.create({
      data: {
        title: "Safe link",
        placement: "announcement",
        isActive: true,
        ctaLabel: "Xem shop",
        ctaHref: "/shop#catalog",
        priority: 50,
      },
    });

    const active = await getActivePromotions({ now });
    expect(active.length).toBe(1);
    expect(active[0].title).toBe("Safe link");
  });

  it("trả về mảng rỗng khi không có promotion nào thỏa mãn", async () => {
    const active = await getActivePromotions();
    expect(active).toEqual([]);
  });
});

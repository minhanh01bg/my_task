import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { STORE_PASSWORD } from "./credentials";

test("tổng quan hợp nhất biểu đồ và sản phẩm bán nhiều, lãi cao", async ({
  page,
}, testInfo) => {
  const prisma = new PrismaClient();
  const prefix = `e2e-analytics-${crypto.randomUUID()}`;
  try {
    const products = await prisma.product.findMany({
      take: 2,
      orderBy: { id: "asc" },
    });
    expect(products).toHaveLength(2);
    for (const [index, profit] of [true, false].entries()) {
      await prisma.order.create({
        data: {
          code: `${prefix}-${index}`,
          clientId: `${prefix}-${index}`,
          channel: profit ? "online" : "pos",
          status: "paid",
          subtotal: profit ? 150_000 : 100_000,
          total: profit ? 150_000 : 100_000,
          createdAt: new Date(Date.now() - (profit ? 1_000 : 86_400_000)),
          items: {
            create: {
              productId: products[index].id,
              nameSnapshot: profit
                ? "Bugi lãi cao kiểm thử"
                : "Bugi bán lỗ kiểm thử",
              unitPrice: 50_000,
              originalPrice: 50_000,
              quantity: profit ? 3 : 2,
              lineTotal: profit ? 150_000 : 100_000,
              costPriceSnapshot: profit ? 10_000 : 100_000,
              unit: "cái",
            },
          },
        },
      });
    }
    await page.goto("/login?next=%2Fadmin");
    await page.getByLabel("Mật khẩu cửa hàng").fill(STORE_PASSWORD);
    await page.getByRole("button", { name: "Vào bán hàng" }).click();
    await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await expect(
      page.getByRole("img", { name: /^Doanh thu 7 ngày:/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: /^Số đơn theo ngày:/ }),
    ).toBeVisible();
    const profitChart = page.getByRole("img", {
      name: /^Lợi nhuận gộp theo ngày:/,
    });
    await expect(profitChart).toBeVisible();
    await expect(profitChart.locator("[data-zero-baseline]")).toHaveCount(1);
    await expect(
      page.getByRole("progressbar", { name: "Tỷ trọng số đơn Online" }),
    ).toHaveAttribute("value", "50");
    const quantity = page.getByLabel("Top 5 bán nhiều nhất", { exact: true });
    const profit = page.getByLabel("Top 5 lợi nhuận gộp", { exact: true });
    await expect(quantity.locator("li").first()).toContainText(
      "Bugi lãi cao kiểm thử",
    );
    await expect(quantity.locator("li").first()).toContainText("3 cái");
    await expect(profit.locator("li").first()).toContainText("120.000");
    await page.screenshot({
      path: testInfo.outputPath("unified-dashboard.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "30 ngày", exact: true }).click();
    await expect(
      page.getByRole("img", { name: /^Doanh thu 30 ngày:/ }),
    ).toBeVisible();
    await page.goto("/admin/reports?days=14");
    await expect(page).toHaveURL(/\/admin\?days=14$/);
    await expect(
      page.getByRole("img", { name: /^Doanh thu 14 ngày:/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Báo cáo", exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath("unified-dashboard-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "30 ngày", exact: true }).click();
    await expect(
      page.getByRole("img", { name: /^Doanh thu 30 ngày:/ }),
    ).toBeVisible();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  } finally {
    await prisma.order.deleteMany({
      where: { clientId: { startsWith: prefix } },
    });
    await prisma.$disconnect();
  }
});

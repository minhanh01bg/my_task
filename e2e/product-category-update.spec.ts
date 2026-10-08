import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) {
  test(`đổi danh mục sản phẩm có ảnh mặc định ở ${width}px`, async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/login?next=%2Fadmin");
    await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: "Vào bán hàng" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/admin/products");
    await page
      .getByRole("button", { name: "Sửa Mì Hảo Hảo tôm chua cay", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Sửa sản phẩm: Mì Hảo Hảo tôm chua cay",
    });
    const targetName = width === 1440 ? "Phụ tùng xe" : "Tạp hoá";
    await dialog.getByRole("button", { name: targetName, exact: true }).click();
    await dialog
      .getByRole("button", { name: "Lưu thay đổi", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(
      page.locator('[data-slot="toast"][data-type="success"]'),
    ).toContainText("Đã lưu sản phẩm thành công");
    const prisma = new PrismaClient();
    try {
      const product = await prisma.product.findFirstOrThrow({
        where: { name: "Mì Hảo Hảo tôm chua cay" },
        include: { category: true },
      });
      expect(product.category?.name).toBe(targetName);
      expect(product.imageUrl).toBe("/products/mi-hao-hao.webp");
      expect(product.price).toBe(4500);
    } finally {
      await prisma.$disconnect();
    }
    await page.reload();
    await page
      .getByRole("button", { name: "Sửa Mì Hảo Hảo tôm chua cay", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: targetName, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}

import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const prisma = new PrismaClient();
const title = `Ưu đãi kiểm tra ${randomUUID().slice(0, 8)}`;

test.beforeEach(async ({ page }) => {
  if (process.env.PLAYWRIGHT_PRODUCTION_DIR)
    await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
});

test.afterAll(async () => {
  await prisma.storefrontPromotion.deleteMany({ where: { title } });
  await prisma.$disconnect();
});

test("chuyển hướng người dùng chưa đăng nhập", async ({ page }) => {
  await page.goto("/admin/promotions");
  await expect(page).toHaveURL(/\/login/);
});

test("khuyến mãi: validation, xem trước, tạo, tạm dừng và xóa", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await page.goto("/admin/promotions");
  const form = page.getByRole("form", { name: "Tạo chiến dịch", exact: true });
  const input = form.getByLabel("Tiêu đề khuyến mãi (bắt buộc)");
  const submit = form.getByRole("button", { name: /tạo chiến dịch/i });
  await input.fill("   ");
  await submit.click();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill(title);
  await form
    .getByLabel("Đường dẫn nút", { exact: true })
    .fill("javascript:alert(1)");
  await submit.click();
  await expect(form.getByLabel("Đường dẫn nút", { exact: true })).toBeFocused();
  await form.getByLabel("Đường dẫn nút", { exact: true }).fill("/shop#catalog");
  await form.getByLabel("Nội dung nút", { exact: true }).fill("Khám phá ngay");
  await form.getByText("Banner đầu trang", { exact: true }).click();
  await expect(
    form.getByRole("radio", { name: /Banner đầu trang/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Di động", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Di động", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "/tmp/promotions-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/promotions-mobile.png", fullPage: true });
  await submit.click();
  await expect(input).toHaveValue("");
  await expect(
    page.getByText("Tạo chiến dịch khuyến mãi thành công", { exact: true }),
  ).toBeVisible();
  await page.locator('[data-slot="toast"]').hover();
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(
    page.getByRole("button", { name: "Đóng thông báo" }),
  ).toHaveCount(0);
  const row = page.getByRole("article", {
    name: `Chiến dịch ${title}`,
    exact: true,
  });
  await expect(row).toBeVisible();
  expect(
    (await prisma.storefrontPromotion.findFirstOrThrow({ where: { title } }))
      .placement,
  ).toBe("hero");
  await row.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Kích hoạt", exact: true }),
  ).toBeVisible();
  expect(
    (await prisma.storefrontPromotion.findFirstOrThrow({ where: { title } }))
      .isActive,
  ).toBe(false);
  await expect(
    page.getByText("Đã tạm dừng khuyến mãi", { exact: true }),
  ).toBeVisible();
  await page.locator('[data-slot="toast"]').hover();
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(
    page.getByRole("button", { name: "Đóng thông báo" }),
  ).toHaveCount(0);
  await row.getByRole("button", { name: "Kích hoạt", exact: true }).click();
  await expect(
    row.getByRole("button", { name: "Tạm dừng", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Đã bật khuyến mãi", { exact: true }),
  ).toBeVisible();
  await page.locator('[data-slot="toast"]').hover();
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(
    page.getByRole("button", { name: "Đóng thông báo" }),
  ).toHaveCount(0);
  await row.getByRole("button", { name: "Xóa", exact: true }).click();
  await page.getByRole("button", { name: "Quay lại", exact: true }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Xóa", exact: true }).click();
  await page
    .getByRole("button", { name: "Xóa chiến dịch", exact: true })
    .click();
  await expect(
    page.getByText("Đã xóa chiến dịch khuyến mãi", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", {
      name: `Xóa chiến dịch “${title}”?`,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(row).toHaveCount(0);
  expect(await prisma.storefrontPromotion.count({ where: { title } })).toBe(0);
});

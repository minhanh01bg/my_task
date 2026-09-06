import { expect, test } from "@playwright/test";

test("khách truy cập cửa hàng công khai và tìm sản phẩm", async ({ page }) => {
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: "Hàng thiết yếu, đặt nhanh tại nhà" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Tìm tên sản phẩm…")).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
});

test("route nội bộ vẫn yêu cầu đăng nhập", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/login/);
});

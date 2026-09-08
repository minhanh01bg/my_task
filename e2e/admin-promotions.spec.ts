import { expect, test } from "@playwright/test";

test.describe("Quản lý chương trình khuyến mãi storefront", () => {
  test("chuyển hướng người dùng chưa đăng nhập về trang đăng nhập", async ({
    page,
  }) => {
    await page.goto("/admin/promotions");
    await expect(page).toHaveURL(/\/login/);
  });

  test("quản trị viên tạo và xem danh sách khuyến mãi", async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Mật khẩu cửa hàng" })
      .fill("123456");
    await page.getByRole("button", { name: /vào bán hàng/i }).click();
    await page.waitForURL("**/pos");

    await page.goto("/admin/promotions");
    await expect(
      page.getByRole("heading", { name: /quản lý khuyến mãi/i }),
    ).toBeVisible();

    // Fill form
    await page.getByLabel(/tiêu đề/i).fill("Ưu đãi khai xuân");
    await page
      .getByLabel(/nội dung chi tiết/i)
      .fill("Giảm 10% cho mọi đơn hàng online");
    await page.getByLabel(/nhãn nút cta/i).fill("Khám phá ngay");
    await page.getByLabel(/đường dẫn cta/i).fill("/shop#catalog");

    // Click submit
    await page.getByRole("button", { name: /tạo chiến dịch/i }).click();

    // Check newly created promotion appears in the list
    await expect(page.getByText("Ưu đãi khai xuân").first()).toBeVisible();
    await expect(
      page.getByText("Giảm 10% cho mọi đơn hàng online").first(),
    ).toBeVisible();
  });
});

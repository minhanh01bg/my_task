import { expect, test } from "@playwright/test";

test.describe("Quản lý sản phẩm", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Mật khẩu cửa hàng" })
      .fill("123456");
    await page.getByRole("button", { name: /vào bán hàng/i }).click();
    await page.waitForURL("**/pos");
  });

  test("them san pham roi tim duoc ngay o POS qua ten goi khac", async ({
    page,
  }) => {
    await page.goto("/admin/products");

    await page.getByLabel("Tên sản phẩm").fill("Ruột xe Dream");
    await page.getByText(/thông tin thêm/i).click();
    await page.getByLabel(/tên gọi khác/i).fill("sam dream, ruot dream");
    await page.getByLabel("Đơn vị bán").fill("cái");
    await page.getByLabel("Giá bán").fill("55000");
    await page.getByLabel("Số lượng đang có").fill("10");
    await page.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();

    await expect(page.getByText("Ruột xe Dream").first()).toBeVisible();

    // Tim duoc bang ten goi khac, khong dau
    await page.goto("/pos");
    await page.getByRole("combobox").fill("sam dream");
    await expect(
      page.getByRole("option", { name: /Ruột xe Dream/ }).first(),
    ).toBeVisible();
  });

  test("ban ghi no roi tat toan o trang cong no", async ({ page }) => {
    await page.goto("/pos");

    const search = page.getByRole("combobox");
    await search.fill("duong");
    await search.press("Enter");

    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("tab", { name: /ghi nợ/i }).click();
    await page.getByLabel(/tên khách nợ/i).fill("Bà Lan");
    await page.getByRole("button", { name: /tạo khách mới/i }).click();
    await page.getByRole("button", { name: /^xác nhận/i }).click();
    await page.getByRole("button", { name: /đơn mới/i }).click();

    await page.goto("/admin/debts");
    // Trang no hien ten khach hai lan: mot o dau nhom, mot o dong don.
    await expect(page.getByText("Bà Lan").first()).toBeVisible();

    await page
      .getByRole("button", { name: /ghi nhận trả nợ/i })
      .first()
      .click();
    await page.getByRole("button", { name: /xác nhận đã nhận/i }).click();
    await expect(
      page.getByText("0 đơn đã trả đủ", { exact: true }),
    ).toBeVisible();
  });
});

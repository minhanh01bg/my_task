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
    await page
      .getByRole("button", { name: "Thêm sản phẩm", exact: true })
      .click();
    const productDialog = page.getByRole("dialog", {
      name: "Thêm sản phẩm mới",
    });
    await productDialog.getByLabel("Tên sản phẩm").fill("Ruột xe Dream");
    await productDialog.getByText(/thông tin thêm/i).click();
    await productDialog
      .getByLabel(/tên gọi khác/i)
      .fill("sam dream, ruot dream");
    await productDialog.getByLabel("Đơn vị bán").fill("cái");
    await productDialog
      .getByRole("spinbutton", { name: "Giá bán", exact: true })
      .fill("55000");
    await productDialog
      .getByRole("spinbutton", { name: "Số lượng tồn kho", exact: true })
      .fill("10");
    await productDialog
      .getByRole("button", { name: "Lưu và nhập món tiếp" })
      .click();
    await expect(productDialog).not.toBeVisible();

    await expect(page.getByText("Ruột xe Dream").first()).toBeVisible();

    // Tim duoc bang ten goi khac, khong dau
    await page.goto("/pos");
    await page.getByRole("combobox").fill("sam dream");
    await expect(
      page.getByRole("option", { name: /Ruột xe Dream/ }).first(),
    ).toBeVisible();
  });

  test("ban ghi no roi tat toan o trang cong no", async ({ page }) => {
    const customerName = `Bà Lan E2E ${Date.now()}`;
    await page.goto("/pos");

    const search = page.getByRole("combobox");
    await search.fill("duong");
    await page
      .getByRole("option", { name: /Đường trắng/ })
      .first()
      .click();

    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("tab", { name: /ghi nợ/i }).click();
    await page.getByLabel(/tên khách nợ/i).fill(customerName);
    await page.getByRole("button", { name: /tạo khách mới/i }).click();
    await page.getByRole("button", { name: /^xác nhận/i }).click();
    await page.getByRole("button", { name: /đơn mới/i }).click();

    await page.goto("/admin/debts");
    const debtRow = page.getByRole("row").filter({ hasText: customerName });
    await expect(debtRow).toBeVisible();
    await debtRow.getByRole("button", { name: /ghi nhận trả nợ/i }).click();
    await debtRow.getByRole("button", { name: /xác nhận đã nhận/i }).click();
    await expect(debtRow).toHaveCount(0);
    const settledOrder = page.getByRole("listitem").filter({
      has: page.getByText(customerName, { exact: true }),
    });
    await expect(
      settledOrder.getByText("Đã trả đủ", { exact: true }),
    ).toBeVisible();
  });
});

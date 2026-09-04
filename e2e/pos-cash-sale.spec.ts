import { expect, test } from "@playwright/test";

test.describe("Bán hàng tiền mặt", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: /vào bán hàng/i }).click();
    await page.waitForURL("**/pos");
  });

  test("chua dang nhap thi bi chuyen ve trang dang nhap", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/pos");
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test("go tim, them vao gio, thanh toan tien mat", async ({ page }) => {
    const search = page.getByRole("combobox");

    await search.fill("nhot");
    await expect(page.getByText("Nhớt Castrol Power1 0.8L")).toBeVisible();

    await search.press("Enter");
    await expect(page.getByText("Nhớt Castrol Power1 0.8L")).toBeVisible();
    await expect(page.getByTestId("cart-total")).toHaveText("120.000");

    await search.fill("sen wave");
    await expect(page.getByText("Bộ nhông sên dĩa xe Wave")).toBeVisible();
    await search.press("Enter");
    await expect(page.getByTestId("cart-total")).toHaveText("400.000");

    await page.getByRole("button", { name: /thanh toán/i }).click();
    await expect(page.getByTestId("payment-total")).toHaveText("400.000");

    await page.getByRole("button", { name: "500.000" }).click();
    await expect(page.getByTestId("payment-change")).toHaveText("100.000");

    await page.getByRole("button", { name: /^xác nhận/i }).click();

    await expect(page.getByTestId("last-sale-change")).toHaveText("100.000");
    await expect(page.getByText(/DH\d+/)).toBeVisible();

    await page.getByRole("button", { name: /đơn mới/i }).click();
    await expect(page.getByText(/chưa có sản phẩm/i)).toBeVisible();
  });

  test("go khong dau tim duoc hang phu tung qua tu khoa phu", async ({
    page,
  }) => {
    await page.getByRole("combobox").fill("bugi wave");
    await expect(page.getByText("Bugi NGK C7HSA")).toBeVisible();
  });

  test("sua so luong le cap nhat tong tien", async ({ page }) => {
    const search = page.getByRole("combobox");
    await search.fill("day dien");
    await search.press("Enter");

    const quantity = page.getByLabel(/số lượng/i);
    await quantity.fill("2.5");

    await expect(page.getByTestId("cart-total")).toHaveText("37.500");
  });
});

import { expect, test } from "@playwright/test";

test.describe("Bán khi mất mạng", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page
      .getByRole("textbox", { name: "Mật khẩu cửa hàng" })
      .fill("123456");
    await page.getByRole("button", { name: /vào bán hàng/i }).click();
    await page.waitForURL("**/pos");
  });

  test("mat mang van ban duoc, co mang lai thi tu dong bo", async ({
    page,
    context,
  }) => {
    const search = page.getByRole("combobox");

    // Ban binh thuong truoc de chac chan luong online van chay
    await search.fill("nhot");
    await search.press("Enter");
    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("button", { name: /đúng số tiền/i }).click();
    await page.getByRole("button", { name: /^xác nhận/i }).click();
    await expect(page.getByText(/Đã lưu đơn DH/)).toBeVisible();
    await page.getByRole("button", { name: /đơn mới/i }).click();

    // Ngat mang
    await context.setOffline(true);

    await search.fill("duong");
    await search.press("Enter");
    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("button", { name: /đúng số tiền/i }).click();
    await page.getByRole("button", { name: /^xác nhận/i }).click();

    // Van ban duoc, chi bao doi trang thai
    await expect(page.getByText(/sẽ đồng bộ khi có mạng/i)).toBeVisible();
    await page.getByRole("button", { name: /đơn mới/i }).click();

    // Co mang lai
    await context.setOffline(false);

    await expect(page.getByText(/đơn chờ đồng bộ/)).toBeHidden({
      timeout: 10_000,
    });
  });

  test("giu don roi mo lai", async ({ page }) => {
    const search = page.getByRole("combobox");

    await search.fill("nhot");
    await search.press("Enter");
    await expect(page.getByTestId("cart-total")).toHaveText("120.000");

    await page.getByRole("button", { name: /giữ đơn/i }).click();
    await expect(page.getByText(/chưa có sản phẩm/i)).toBeVisible();
    await expect(page.getByText(/đơn đang giữ/i)).toBeVisible();

    await page.getByRole("button", { name: /#1 — 120\.000/ }).click();
    await expect(page.getByTestId("cart-total")).toHaveText("120.000");
  });
});

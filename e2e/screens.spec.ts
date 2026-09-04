import { test } from "@playwright/test";

/** Chup man hinh that de doi chieu bang mat — khong khang dinh gi. */
test.describe("anh chup man hinh", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`pos va admin o theme ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/login");
      await page.getByPlaceholder("Mật khẩu cửa hàng").fill("123456");
      await page.getByRole("button", { name: /vào bán hàng/i }).click();
      await page.waitForURL("**/pos");

      await page.getByRole("combobox").fill("nhot");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `test-results/pos-${scheme}.png` });

      await page.goto("/admin/products");
      await page.screenshot({
        path: `test-results/admin-products-${scheme}.png`,
        fullPage: true,
      });

      await page.goto("/admin/reports");
      await page.screenshot({
        path: `test-results/admin-reports-${scheme}.png`,
        fullPage: true,
      });
    });
  }
});

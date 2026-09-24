import { test } from "@playwright/test";

/** Anh ghi vao day (da gitignore) — test-results/ bi Playwright xoa moi lan chay. */
const SHOTS = "e2e/screenshots";

/** Chup man hinh that de doi chieu bang mat — khong khang dinh gi. */
test.describe("anh chup man hinh", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`pos va admin o theme ${scheme}`, async ({ page }) => {
      // ThemeProvider co defaultTheme="light" nen emulateMedia bi bo qua —
      // dat thang lua chon ma next-themes doc tu localStorage truoc khi tai.
      await page.addInitScript((theme) => {
        window.localStorage.setItem("theme", theme);
      }, scheme);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/login");
      await page
        .getByRole("textbox", { name: "Mật khẩu cửa hàng" })
        .fill("123456");
      await page.getByRole("button", { name: /vào bán hàng/i }).click();
      await page.waitForURL("**/pos");

      await page.getByRole("combobox").fill("nhot");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/pos-${scheme}.png` });

      await page.goto("/admin/products");
      await page.screenshot({
        path: `${SHOTS}/admin-products-${scheme}.png`,
        fullPage: true,
      });

      await page.goto("/admin/reports");
      await page.screenshot({
        path: `${SHOTS}/admin-reports-${scheme}.png`,
        fullPage: true,
      });
    });
  }
});

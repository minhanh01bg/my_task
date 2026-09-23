import { expect, test } from "@playwright/test";

test.describe("UI kit gallery", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`hien day du o theme ${scheme}`, async ({ page }) => {
      // ThemeProvider co defaultTheme="light" nen emulateMedia bi bo qua —
      // dat thang lua chon ma next-themes doc tu localStorage truoc khi tai.
      await page.addInitScript((theme) => {
        window.localStorage.setItem("theme", theme);
      }, scheme);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/dev/kit");

      await expect(
        page.getByRole("heading", { level: 1, name: "UI Kit" }),
      ).toBeVisible();
      // Cung mot du lieu mau duoc dung cho ca ProductTile lan ResultRow,
      // nen moi nhan xuat hien hai lan — chi can kiem mot.
      await expect(
        page.getByText("Hết hàng", { exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByText("Còn 50 cái").first()).toBeVisible();

      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${scheme}\\b`),
      );

      // Ghi vao e2e/screenshots/ (da gitignore) — ca test-results/ lan
      // playwright-report/ deu bi Playwright xoa sach, cuon mat luon anh chup.
      await page.screenshot({
        path: `e2e/screenshots/kit-${scheme}.png`,
        fullPage: true,
      });
    });
  }
});

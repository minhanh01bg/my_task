import { expect, test } from "@playwright/test";

test.describe("UI kit gallery", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`hien day du o theme ${scheme}`, async ({ page }) => {
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

      // Ghi vao test-results/ chu khong phai playwright-report/ — reporter
      // HTML xoa sach thu muc bao cao khi ket thuc, cuon mat luon anh chup.
      await page.screenshot({
        path: `test-results/kit-${scheme}.png`,
        fullPage: true,
      });
    });
  }
});

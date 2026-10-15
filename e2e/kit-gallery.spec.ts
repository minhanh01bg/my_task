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

      const checkboxes = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Checkbox", exact: true }),
      });
      await checkboxes.scrollIntoViewIfNeeded();
      const checkbox = checkboxes.getByRole("checkbox", {
        name: "Chưa chọn",
        exact: true,
      });
      await expect(checkbox).not.toBeChecked();
      await checkboxes.getByText("Chưa chọn", { exact: true }).click();
      await expect(checkbox).toBeChecked();
      await expect(
        checkbox.locator('[data-slot="checkbox-indicator"]'),
      ).toHaveCSS("opacity", "1");
      await page.keyboard.press("Space");
      await expect(checkbox).not.toBeChecked();
      await expect(
        checkbox.locator('[data-slot="checkbox-indicator"]'),
      ).toHaveCSS("opacity", "0");
      await expect(
        checkboxes.getByRole("checkbox", {
          name: "Chọn một phần",
          exact: true,
        }),
      ).toHaveAttribute("aria-checked", "mixed");
      await checkboxes.getByText("Vô hiệu hoá", { exact: true }).click();
      await expect(
        checkboxes.getByRole("checkbox", { name: "Vô hiệu hoá", exact: true }),
      ).not.toBeChecked();
      await checkboxes.screenshot({
        path: `e2e/screenshots/checkboxes-${scheme}.png`,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(checkbox).toHaveCSS("transition-duration", "0s");
      await expect(
        checkbox.locator('[data-slot="checkbox-indicator"]'),
      ).toHaveCSS("transition-duration", "0s");

      const notifications = page.locator("section").filter({
        has: page.getByRole("heading", { name: "Thông báo", exact: true }),
      });
      await notifications.scrollIntoViewIfNeeded();
      await expect(notifications.getByText("Có đơn online mới")).toBeVisible();
      await expect(notifications.getByRole("status")).toBeVisible();
      await notifications.screenshot({
        path: `e2e/screenshots/notifications-${scheme}.png`,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(notifications.locator("li").first()).toHaveCSS(
        "animation-name",
        "none",
      );
      await expect(notifications.locator("li").first()).toHaveCSS(
        "animation-delay",
        "0s",
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

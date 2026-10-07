import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
});

test("desktop: parent toggles children, active child opens automatically and keyboard collapses", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", {
    name: "Điều hướng quản lý",
    exact: true,
  });
  const parent = nav.getByRole("button", { name: "Khuyến mãi", exact: true });
  await expect(parent).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveCount(0);
  await parent.click();
  await expect(page).toHaveURL(/\/pos$/);
  await nav
    .getByRole("link", { name: "Chiến dịch khuyến mãi", exact: true })
    .click();
  await page.waitForURL("**/admin/promotions");
  await expect(parent).toHaveAttribute("aria-expanded", "true");
  await nav.getByRole("link", { name: "Mã giảm giá", exact: true }).click();
  await page.waitForURL("**/admin/promotions/vouchers");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Chiến dịch khuyến mãi", exact: true }),
  ).not.toHaveAttribute("aria-current");
  await page.reload();
  await expect(parent).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({
    path: "/tmp/sidebar-group-desktop.png",
    animations: "disabled",
  });
  await parent.focus();
  await page.keyboard.press("Space");
  await expect(parent).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    nav.getByRole("link", { name: "Đánh giá", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(parent).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toBeVisible();
});

test("compact: keeps trigger focus, opens flyout, Escape returns focus and child navigation closes it", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", {
    name: "Điều hướng quản lý",
    exact: true,
  });
  const parent = nav.getByRole("button", { name: "Khuyến mãi", exact: true });
  await parent.focus();
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        'button[aria-controls="admin-desktop-sidebar"]',
      )!
      .click(),
  );
  await expect(parent).toBeFocused();
  await expect
    .poll(
      async () =>
        (await page.locator("#admin-desktop-sidebar").boundingBox())!.width,
    )
    .toBe(72);
  await page.keyboard.press("Enter");
  const flyout = page.getByRole("dialog", { name: "Khuyến mãi", exact: true });
  await expect(
    flyout.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/sidebar-group-compact.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(flyout).toHaveCount(0);
  await expect(parent).toBeFocused();
  await parent.click();
  await expect(flyout).toBeVisible();
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        'button[aria-controls="admin-desktop-sidebar"]',
      )!
      .click(),
  );
  await expect(flyout).toHaveCount(0);
  await page.evaluate(() =>
    document
      .querySelector<HTMLButtonElement>(
        'button[aria-controls="admin-desktop-sidebar"]',
      )!
      .click(),
  );
  await expect(parent).toHaveAttribute("aria-expanded", "false");
  await expect(flyout).toHaveCount(0);
  await parent.click();
  await flyout.getByRole("link", { name: "Mã giảm giá", exact: true }).click();
  await page.waitForURL("**/admin/promotions/vouchers");
  await expect(flyout).toHaveCount(0);
  await page.getByRole("button", { name: "Mở rộng thanh điều hướng" }).click();
  await expect(parent).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("mobile: parent expands inside menu, child closes sheet and current group opens on return", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mở toàn bộ menu quản lý" }).click();
  const menu = page.getByRole("dialog", { name: "Menu quản lý", exact: true });
  const parent = menu.getByRole("button", { name: "Khuyến mãi", exact: true });
  await expect(parent).toHaveAttribute("aria-expanded", "false");
  await parent.click();
  await expect(menu).toBeVisible();
  await page.screenshot({
    path: "/tmp/sidebar-group-mobile.png",
    animations: "disabled",
  });
  await menu.getByRole("link", { name: "Mã giảm giá", exact: true }).click();
  await page.waitForURL("**/admin/promotions/vouchers");
  await expect(menu).toHaveCount(0);
  await page.getByRole("button", { name: "Mở toàn bộ menu quản lý" }).click();
  await expect(parent).toHaveAttribute("aria-expanded", "true");
  await expect(
    menu.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

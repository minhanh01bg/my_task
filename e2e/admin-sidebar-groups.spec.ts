import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
});

test("desktop: parent opens campaign in one click, separate toggle and current child work", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", {
    name: "Điều hướng quản lý",
    exact: true,
  });
  const parent = nav.getByRole("link", { name: "Khuyến mãi", exact: true });
  const toggle = nav.getByRole("button", {
    name: "Mở/thu mục con Khuyến mãi",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveCount(0);
  await toggle.click();
  await expect(page).toHaveURL(/\/pos$/);
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await parent.focus();
  await page.keyboard.press("Space");
  await expect(page).toHaveURL(/\/pos$/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/admin/promotions");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await nav.getByRole("link", { name: "Mã giảm giá", exact: true }).click();
  await page.waitForURL("**/admin/promotions/vouchers");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    nav.getByRole("link", { name: "Chiến dịch khuyến mãi", exact: true }),
  ).not.toHaveAttribute("aria-current");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({
    path: "/tmp/sidebar-group-desktop.png",
    animations: "disabled",
  });
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(
    nav.getByRole("link", { name: "Mã giảm giá", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Tab");
  await expect(
    nav.getByRole("link", { name: "Đánh giá", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(toggle).toBeFocused();
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
  await nav.getByRole("link", { name: "Khuyến mãi", exact: true }).focus();
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
  await page.keyboard.press("Space");
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
  await expect(
    nav.getByRole("button", { name: "Mở/thu mục con Khuyến mãi", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
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
  const parent = menu.getByRole("button", {
    name: "Mở/thu mục con Khuyến mãi",
    exact: true,
  });
  await expect(parent).toHaveAttribute("aria-expanded", "false");
  await parent.click();
  await expect(page).toHaveURL(/\/pos$/);
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

test("mobile: parent reaches campaign in one click and closes menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Mở toàn bộ menu quản lý" }).click();
  const menu = page.getByRole("dialog", { name: "Menu quản lý", exact: true });
  await menu.getByRole("link", { name: "Khuyến mãi", exact: true }).click();
  await page.waitForURL("**/admin/promotions");
  await expect(menu).toHaveCount(0);
});

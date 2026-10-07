import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
});

test("trang goc chuyen huong vinh vien sang cua hang", async ({ page }) => {
  // "/" la diem vao cong khai: redirect 308 (next.config.ts) sang /shop.
  // POS van o /pos va chi mo sau dang nhap.
  const response = await page.request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toMatch(/\/shop$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/shop$/);
});

for (const width of [390, 1440]) {
  test(`chủ cửa hàng đăng nhập từ đầu trang ở màn hình ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/shop");
    const loginLink = page
      .locator("header")
      .getByRole("link", { name: "Đăng nhập quản trị" });
    await expect(loginLink).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath("admin-entry.png"),
      clip: { x: 0, y: 0, width, height: 108 },
    });
    await loginLink.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: "Vào bán hàng" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator("#admin-main-content")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/shop");
    const adminEntry = page.locator("header").getByRole("button", {
      name: "Quay lại trang quản trị",
    });
    await expect(adminEntry).toBeInViewport();
    await expect(page.locator('header a[href^="/admin"]')).toHaveCount(1);
    await expect(
      page.getByRole("navigation", {
        name: "Truy cập quản trị cửa hàng",
      }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath("admin-entry-authenticated.png"),
      clip: { x: 0, y: 0, width, height: 80 },
    });
  });
}

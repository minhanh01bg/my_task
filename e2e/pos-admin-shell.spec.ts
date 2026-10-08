import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  if (process.env.PLAYWRIGHT_PRODUCTION_DIR) {
    // Mô phỏng header của reverse proxy trên server fixture production.
    await page.setExtraHTTPHeaders({
      "X-Real-IP": "1.1.1.1",
    });
  }
  await page.goto("/login?next=%2Fpos");
  await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Vào bán hàng" }).click();
  expect((await loginResponse).status()).toBe(200);
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "pos_session",
    ),
  ).toBe(true);
  await expect(page).toHaveURL(/\/pos$/);
});

test("quầy dùng menu admin, chuyển mục giữ giỏ và ẩn/hiện sidebar", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", {
    name: "Điều hướng quản lý",
    exact: true,
  });
  await expect(
    nav.getByRole("link", { name: "Quầy bán hàng" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Quản lý cửa hàng", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("combobox").fill("nhot");
  await page.getByRole("option").getByText("Nhớt Castrol Power1 0.8L").click();
  await expect(
    page.getByTestId("cart-total").filter({ visible: true }),
  ).toHaveText("120.000");
  await nav.getByRole("link", { name: /^Sản phẩm/ }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await nav.evaluate((node) =>
    node.setAttribute("data-shell-persisted", "true"),
  );
  await nav.getByRole("link", { name: "Quầy bán hàng" }).click();
  await expect(
    page.getByTestId("cart-total").filter({ visible: true }),
  ).toHaveText("120.000");
  await expect(nav).toHaveAttribute("data-shell-persisted", "true");
  await page.getByRole("button", { name: "Thu gọn thanh điều hướng" }).click();
  await expect(nav).toBeVisible();
  await expect(page.locator("#admin-desktop-sidebar")).toHaveAttribute(
    "data-compact",
    "true",
  );
  await expect(
    nav.getByRole("link", { name: "Quầy bán hàng" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByTestId("cart-total").filter({ visible: true }),
  ).toHaveText("120.000");
  await page.getByRole("button", { name: "Mở rộng thanh điều hướng" }).click();
  await expect(nav).toBeVisible();
  await test.info().attach("Quầy trong layout admin desktop", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.reload();
  await expect(
    page.getByTestId("cart-total").filter({ visible: true }),
  ).toHaveText("120.000");
});

for (const width of [320, 390, 820]) {
  test(`màn hình ${width}px: chỉ một nút thanh toán trong đơn`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("combobox").fill("nhot");
    await page
      .getByRole("option")
      .getByText("Nhớt Castrol Power1 0.8L")
      .click();
    await expect(page.getByTestId("pos-mobile-checkout")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Tính tiền", exact: true }),
    ).toHaveCount(0);
    const checkout = page.getByRole("button", { name: /thanh toán/i });
    await expect(checkout).toHaveCount(1);
    await checkout.scrollIntoViewIfNeeded();
    await expect(checkout).toBeInViewport();
    if (width < 768) {
      const nav = page.getByRole("navigation", {
        name: "Điều hướng quản lý trên điện thoại",
      });
      await expect(nav).toBeVisible();
      const menuBox = await nav.boundingBox();
      const checkoutBox = await checkout.boundingBox();
      expect(checkoutBox!.y + checkoutBox!.height).toBeLessThanOrEqual(
        menuBox!.y,
      );
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: `/tmp/pos-single-checkout-${width}.png`,
      fullPage: true,
    });
    await checkout.click();
    await expect(
      page.getByRole("button", { name: "Đúng số tiền", exact: true }),
    ).toBeVisible();
  });
}

test("production offline: tải lại quầy giữ giỏ rồi thanh toán và đồng bộ", async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.PLAYWRIGHT_PRODUCTION_DIR,
    "Service worker chỉ được đăng ký trong production",
  );
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.getByRole("combobox").fill("nhot");
  await page.getByRole("option").getByText("Nhớt Castrol Power1 0.8L").click();
  await expect(
    page.getByTestId("cart-total").filter({ visible: true }),
  ).toHaveText("120.000");
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("navigation", { name: "Điều hướng quản lý", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByTestId("cart-total").filter({ visible: true }),
  ).toHaveText("120.000");
  await page.getByRole("button", { name: /thanh toán/i }).click();
  await page.getByRole("button", { name: /đúng số tiền/i }).click();
  await page.getByRole("button", { name: /^xác nhận/i }).click();
  await expect(page.getByText(/sẽ đồng bộ khi có mạng/i)).toBeVisible();
  await page.getByRole("button", { name: /đơn mới/i }).click();
  await context.setOffline(false);
  await expect(page.getByText(/đơn chờ đồng bộ/)).toBeHidden({
    timeout: 15_000,
  });
});

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  if (process.env.PLAYWRIGHT_PRODUCTION_DIR) {
    await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  }
});

test("admin có app shell mobile rõ ràng và menu đầy đủ truy cập được", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  const loginButton = page.getByRole("button", { name: /vào bán hàng/i });
  await expect(loginButton).toBeEnabled();
  await loginButton.click();
  await page.waitForURL("**/pos");
  await page.goto("/admin/orders");

  await expect(page.getByText("Quản lý", { exact: true })).toBeVisible();
  const header = page.getByRole("banner", { name: "Thanh công cụ quản lý" });
  const storefront = header.getByRole("link", { name: "Xem cửa hàng online" });
  await expect(storefront).toBeVisible();
  await expect(storefront).toHaveAttribute("href", "/shop");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(storefront).toBeInViewport();
    const box = await storefront.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(
      await header.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  }
  await test.info().attach("Navbar cửa hàng trên điện thoại", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const mobileNav = page.getByRole("navigation", {
    name: "Điều hướng quản lý trên điện thoại",
  });
  await expect(mobileNav).toBeVisible();
  await expect(
    mobileNav.getByRole("link", { name: "Đơn hàng" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Điều hướng quản lý", exact: true }),
  ).toBeHidden();

  const mainPaddingBottom = await page
    .locator("#admin-main-content")
    .evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).paddingBottom),
    );
  const mobileNavHeight = await mobileNav.evaluate(
    (node) => node.getBoundingClientRect().height,
  );
  expect(mainPaddingBottom).toBeGreaterThan(mobileNavHeight);

  const menuTrigger = mobileNav.getByRole("button", {
    name: "Mở toàn bộ menu quản lý",
  });
  await menuTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Menu quản lý" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Công nợ" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(menuTrigger).toBeFocused();

  await page.getByRole("button", { name: /^Thông báo/ }).click();
  await expect(
    page.getByRole("region", { name: "Thông báo quản trị" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await storefront.click();
  await expect(page).toHaveURL(/\/shop$/);
});

test("chưa đăng nhập truy cập trang quản lý hoặc /admin/login sẽ được chuyển hướng về /login", async ({
  page,
}) => {
  // Khi chưa đăng nhập, truy cập trang quản trị phải chuyển hướng về /login chứ không phải /admin/login (404)
  await page.goto("/admin/products");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fproducts$/);

  // Truy cập trực tiếp /admin/login cũng được chuyển hướng về /login
  await page.goto("/admin/login");
  await expect(page).toHaveURL(/\/login$/);
});

test("admin thay đổi độ rộng thanh điều hướng desktop và giữ lại sau tải trang", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await page.goto("/admin/orders");

  const handle = page.getByRole("separator", {
    name: "Thay đổi chiều rộng thanh điều hướng",
  });
  const header = page.getByRole("banner", { name: "Thanh công cụ quản lý" });
  await expect(
    header.getByRole("link", { name: "Xem cửa hàng online" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Điều hướng quản lý", exact: true })
      .getByRole("link", { name: "Xem cửa hàng online" }),
  ).toHaveCount(0);
  await test.info().attach("Navbar cửa hàng trên desktop", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  const sidebar = page.locator("#admin-desktop-sidebar");
  const main = page.locator("#admin-main-content");
  const sidebarBox = await sidebar.boundingBox();
  const headerBox = await header.boundingBox();
  const mainBox = await main.boundingBox();
  expect(sidebarBox!.y).toBe(0);
  expect(sidebarBox!.height).toBe(900);
  expect(headerBox!.x).toBeCloseTo(sidebarBox!.x + sidebarBox!.width, 0);
  expect(mainBox!.x).toBeCloseTo(headerBox!.x, 0);

  await expect(handle).toBeVisible();
  await handle.focus();
  await page.keyboard.press("End");
  await expect(handle).toHaveAttribute("aria-valuenow", "360");
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(360);
  await page.setViewportSize({ width: 768, height: 900 });
  expect(
    await header.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect(
    await header
      .locator(":scope > div")
      .first()
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await expect(
    header.getByRole("button", { name: "Đăng xuất", exact: true }),
  ).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 900 });
  const drag = await handle.boundingBox();
  await page.mouse.move(drag!.x + drag!.width / 2, drag!.y + 100);
  await page.mouse.down();
  await page.mouse.move(72, drag!.y + 100, { steps: 12 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute("aria-valuenow", "72");
  await expect(sidebar).toHaveAttribute("data-compact", "true");
  const compactBox = await sidebar.boundingBox();
  expect(compactBox!.width).toBe(72);
  expect((await header.boundingBox())!.x).toBe(72);
  const settings = page
    .getByRole("navigation", { name: "Điều hướng quản lý", exact: true })
    .getByRole("link", { name: "Cài đặt" });
  await settings.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Cài đặt");
  await handle.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(settings).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveText("Cài đặt");
  await header
    .getByRole("button", { name: "Mở rộng thanh điều hướng" })
    .focus();
  await test.info().attach("Sidebar icon và navbar trong content", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await page.reload();
  await expect(handle).toHaveAttribute("aria-valuenow", "72");
  await header
    .getByRole("button", { name: "Mở rộng thanh điều hướng" })
    .click();
  await expect(sidebar).not.toHaveAttribute("data-compact");
  await expect(handle).toHaveAttribute("aria-valuenow", "360");
  await handle.focus();
  await page.keyboard.press("End");
  await page.reload();
  await expect(handle).toHaveAttribute("aria-valuenow", "360");
  await expect(
    page.getByRole("navigation", { name: "Điều hướng quản lý", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 500 });
  const desktopNav = page.getByRole("navigation", {
    name: "Điều hướng quản lý",
    exact: true,
  });
  await desktopNav
    .getByRole("link", { name: "Cài đặt" })
    .scrollIntoViewIfNeeded();
  await expect(
    desktopNav.getByRole("link", { name: "Cài đặt" }),
  ).toBeInViewport();
  expect(await desktopNav.evaluate((node) => node.scrollTop)).toBeGreaterThan(
    0,
  );
  expect((await sidebar.boundingBox())!.y).toBe(0);
  expect((await sidebar.boundingBox())!.height).toBe(500);
  await main.evaluate((node) => {
    node.style.minHeight = "1600px";
  });
  await page.evaluate(() => window.scrollTo(0, 500));
  expect((await header.boundingBox())!.y).toBe(0);
  expect((await sidebar.boundingBox())!.y).toBe(0);
});

test("đăng xuất cần xác nhận, Hủy và Escape giữ phiên đăng nhập", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  const logout = page
    .getByRole("banner")
    .getByRole("button", { name: "Đăng xuất", exact: true });
  await logout.click();
  const confirmation = page.getByRole("dialog", {
    name: "Đăng xuất khỏi quản lý?",
  });
  await expect(confirmation.getByRole("button", { name: "Hủy" })).toBeFocused();
  await confirmation.getByRole("button", { name: "Hủy" }).click();
  await expect(confirmation).toBeHidden();
  await expect(page).toHaveURL(/\/pos$/);
  await logout.click();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(logout).toBeFocused();
  await logout.click();
  await confirmation
    .getByRole("button", { name: "Đăng xuất", exact: true })
    .click();
  await page.waitForURL("**/login");
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/login\?/);
});

test("mobile: hủy đăng xuất giữ menu và phiên quản lý", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await page.getByRole("button", { name: "Mở toàn bộ menu quản lý" }).click();
  const menu = page.getByRole("dialog", { name: "Menu quản lý" });
  await menu.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  const confirmation = page.getByRole("dialog", {
    name: "Đăng xuất khỏi quản lý?",
  });
  await expect(confirmation.getByRole("button", { name: "Hủy" })).toBeFocused();
  await confirmation.getByRole("button", { name: "Hủy" }).click();
  await expect(confirmation).toBeHidden();
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await confirmation
    .getByRole("button", { name: "Đăng xuất", exact: true })
    .click();
  await page.waitForURL("**/login");
});

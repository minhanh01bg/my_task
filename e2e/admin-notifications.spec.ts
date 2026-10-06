import { expect, test } from "@playwright/test";

test("API notification từ chối anonymous và customer cookie", async ({
  request,
}) => {
  const anonymous = await request.get("/api/admin/notifications");
  expect(anonymous.status()).toBe(401);
  const customer = await request.get("/api/admin/notifications", {
    headers: { cookie: "customer_session=not-an-admin" },
  });
  expect(customer.status()).toBe(401);
});

test("admin thấy badge, mở panel, đọc và đi đúng order detail", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  const loginButton = page.getByRole("button", { name: /vào bán hàng/i });
  await expect(loginButton).toBeEnabled();
  await loginButton.click();
  await page.waitForURL("**/pos");

  const catalog = await page.request.get("/api/catalog");
  expect(catalog.ok()).toBeTruthy();
  const catalogBody = (await catalog.json()) as {
    products: Array<{ id: string; stock: number }>;
  };
  const productId = catalogBody.products.find(
    (product) => product.stock >= 1,
  )?.id;
  expect(productId).toBeTruthy();

  const checkout = await page.request.post("/api/online/orders", {
    headers: { "X-Real-IP": "1.1.1.1" },
    data: {
      clientId: crypto.randomUUID(),
      lines: [{ productId, quantity: 1 }],
      contactName: "Khách kiểm thử",
      contactPhone: "0900000000",
      fulfillmentType: "pickup",
      paymentMethod: "cod",
      deliveryAddress: "",
      deliveryWard: "",
      deliveryDistrict: "",
      deliveryProvince: "",
      note: "",
    },
  });
  const checkoutBody = await checkout.text();
  expect(checkout.ok(), checkoutBody).toBeTruthy();

  await page.goto("/admin/orders");
  const desktopNotificationButton = page
    .getByRole("banner")
    .getByRole("button", { name: /^Thông báo/ });
  await expect(
    desktopNotificationButton.getByTestId("notification-badge"),
  ).toBeVisible();
  await desktopNotificationButton.click();
  const panel = page.getByRole("region", { name: "Thông báo quản trị" });
  await expect(panel).toBeVisible();
  const panelBounds = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(panelBounds).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(panelBounds!.width).toBeLessThanOrEqual(384);
  expect(panelBounds!.height).toBeLessThanOrEqual(512);
  expect(panelBounds!.x).toBeGreaterThanOrEqual(0);
  expect(panelBounds!.x + panelBounds!.width).toBeLessThanOrEqual(
    viewport!.width,
  );
  const item = page.getByRole("link", { name: /Có đơn online mới/ }).first();
  const href = await item.getAttribute("href");
  expect(href).toMatch(/^\/admin\/orders\//);
  await expect(item).toContainText("Xem đơn hàng");
  await item.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 15000 });
});

test("panel thông báo không bị sidebar cắt ở màn hình desktop hẹp", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 720 });
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await page.goto("/admin");

  await page
    .getByRole("banner")
    .getByRole("button", { name: /^Thông báo/ })
    .click();
  const panel = page.getByRole("region", { name: "Thông báo quản trị" });
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(768);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
  expect(
    await panel.evaluate((node) => node.parentElement === document.body),
  ).toBe(true);
});

test("thông báo trên điện thoại không che thanh điều hướng và vẫn đóng được", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await page.goto("/admin");

  const trigger = page
    .getByRole("banner")
    .getByRole("button", { name: /^Thông báo/ });
  await trigger.click();
  const panel = page.getByRole("region", { name: "Thông báo quản trị" });
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812 - 56);
  await panel.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("hộp thông báo dài cuộn bên trong và giữ tiêu đề trên desktop/mobile", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.route("**/api/admin/notifications?*", async (route) => {
    await route.fulfill({
      json: {
        data: {
          items: Array.from({ length: 20 }, (_, index) => ({
            id: `compact-${index}`,
            kind: "online_order_created",
            title: `Có đơn online mới ${index}`,
            body: "Đơn hàng có nội dung dài ".repeat(30),
            entityType: "order",
            entityId: `order-${index}`,
            href: `/admin/orders/order-${index}`,
            createdAt: "2026-10-06T00:00:00.000Z",
            readAt: null,
          })),
          nextCursor: null,
          unreadCount: 20,
          cutoff: "2026-10-06T00:00:01.000Z",
        },
      },
    });
  });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page
      .getByRole("banner")
      .getByRole("button", { name: /^Thông báo/ })
      .click();
    const panel = page.getByRole("region", { name: "Thông báo quản trị" });
    await expect(panel.getByRole("link")).toHaveCount(20);
    const bounds = await panel.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(Math.min(384, width - 24));
    expect(bounds!.height).toBeLessThanOrEqual(512);
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const scroller = panel.locator(".overflow-y-auto");
    expect(
      await scroller.evaluate((node) => node.scrollHeight > node.clientHeight),
    ).toBe(true);
    await scroller.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
    });
    await expect(
      panel.getByRole("heading", { name: "Thông báo" }),
    ).toBeInViewport();
    await expect(panel.getByRole("link").last()).toBeInViewport();
    await panel.getByRole("button", { name: "Đóng thông báo" }).click();
  }
});

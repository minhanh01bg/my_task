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
    .getByRole("complementary")
    .getByRole("button", { name: /^Thông báo/ });
  await expect(
    desktopNotificationButton.getByTestId("notification-badge"),
  ).toBeVisible();
  await desktopNotificationButton.click();
  const item = page.getByRole("link", { name: /Có đơn online mới/ }).first();
  const href = await item.getAttribute("href");
  expect(href).toMatch(/^\/admin\/orders\//);
  await item.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

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
  await page.getByRole("button", { name: /vào bán hàng/i }).click();

  const prisma = new PrismaClient();
  const productId = (await prisma.product.findFirst({ select: { id: true } }))
    ?.id;
  await prisma.$disconnect();
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
  expect(checkout.ok()).toBeTruthy();

  await page.goto("/admin/orders");
  await expect(page.getByTestId("notification-badge")).toBeVisible();
  await page.getByRole("button", { name: /Thông báo/ }).click();
  const item = page.getByRole("link", { name: /Có đơn online mới/ }).first();
  const href = await item.getAttribute("href");
  expect(href).toMatch(/^\/admin\/orders\//);
  await item.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

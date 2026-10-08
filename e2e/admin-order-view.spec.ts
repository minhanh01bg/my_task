import { expect, test } from "@playwright/test";

import { prisma } from "@/server/db/prisma";
import { createOrder } from "@/server/orders/create-order";

const fixtures: { id: string; code: string; label: string; online: boolean }[] =
  [];

test.beforeAll(async () => {
  for (const online of [false, true]) {
    const label = online
      ? "Mặt hàng online xem đơn"
      : "Mặt hàng tại quầy xem đơn";
    const result = await createOrder({
      clientId: `e2e-view-order-${online}-${Date.now()}`,
      channel: online ? "online" : "pos",
      lines: [
        {
          productId: null,
          name: label,
          unitPrice: 25000,
          originalPrice: 25000,
          quantity: 2,
          discount: 0,
          unit: "gói",
          isService: true,
        },
      ],
      payments: [
        {
          method: online ? "transfer" : "cash",
          amount: 50000,
          receivedAt: online ? null : new Date(),
        },
      ],
      ...(online
        ? {
            initialStatus: "pending",
            online: {
              fulfillmentStatus: "new" as const,
              fulfillmentType: "delivery" as const,
              paymentMethod: "bank_transfer" as const,
              contactName: "Khách xem đơn",
              contactPhone: "0901234567",
              deliveryAddress: "Địa chỉ xem đơn",
              shippingFee: 0,
            },
          }
        : {}),
    });
    fixtures.push({
      id: result.order.id,
      code: result.order.code,
      label,
      online,
    });
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

for (const width of [1440, 390, 320]) {
  for (const online of [false, true]) {
    test(`xem đơn ${online ? "online" : "tại quầy"} từ danh sách ở ${width}px`, async ({
      page,
    }) => {
      await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/login?next=%2Fadmin");
      await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
      const [loginResponse] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().endsWith("/api/auth/login") &&
            response.request().method() === "POST",
        ),
        page.getByRole("button", { name: "Vào bán hàng" }).click(),
      ]);
      expect(loginResponse.status()).toBe(200);
      await expect(page).toHaveURL(/\/admin$/);
      const order = fixtures.find((item) => item.online === online)!;
      await page.goto(`/admin/orders?q=${order.code}`);
      const layout = page.locator(
        width >= 640 ? '[data-layout="table"]' : '[data-layout="cards"]',
      );
      const view = layout.getByRole("link", { name: `Xem đơn ${order.code}` });
      await expect(view).toBeVisible();
      const height = await view.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      expect(height).toBeGreaterThanOrEqual(44);
      await view.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(new RegExp(`/admin/orders/${order.id}$`));
      await expect(
        page.getByRole("heading", { name: order.code, exact: true }),
      ).toBeVisible();
      expect(
        await page
          .getByRole("heading", { name: order.code, exact: true })
          .evaluate((element) => element.getBoundingClientRect().height),
      ).toBeLessThanOrEqual(40);
      await expect(
        page.getByText(order.label, { exact: true }).first(),
      ).toBeVisible();
      await expect(
        page
          .locator("#admin-main-content")
          .getByText("Thanh toán", { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .locator("#admin-main-content")
          .getByText("Khách hàng", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /in hoá đơn/i }),
      ).toBeVisible();
      await expect(
        page.getByText("50.000", { exact: false }).first(),
      ).toBeVisible();
      if (online) {
        await expect(
          page.getByText("Xử lý đơn online", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Địa chỉ xem đơn", { exact: true }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `/tmp/order-view-${online}-${width}.png`,
        fullPage: true,
      });
      await page.getByRole("link", { name: "Quay lại đơn hàng" }).click();
      await expect(page).toHaveURL(/\/admin\/orders$/);
      await page.context().clearCookies();
      await page.goto(`/admin/orders/${order.id}`);
      await expect(page).toHaveURL(/\/login/);
    });
  }
}

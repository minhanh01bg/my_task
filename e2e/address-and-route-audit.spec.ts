import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { saveProduct } from "@/server/products/save-product";

test("đặt giao hàng với địa chỉ Bắc Giang hai cấp, không cần huyện", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  const prisma = new PrismaClient();
  const phone = `09${String(Date.now()).slice(-8)}`;
  try {
    const saved = await saveProduct({
      name: `Hàng địa chỉ mới ${crypto.randomUUID().slice(0, 8)}`,
      unit: "cái",
      price: 50000,
      costPrice: 40000,
      stock: 10,
      isActive: true,
    });
    const product = await prisma.product.findUniqueOrThrow({
      where: { id: saved.id },
    });
    await page.goto(`/shop/p/${product.slug}`);
    await page.getByRole("button", { name: "Mua ngay", exact: true }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.getByLabel("Họ và tên").fill("Khách địa chỉ mới");
    await page.getByLabel("Số điện thoại").fill(phone);
    expect(
      await page.getByRole("combobox", { name: /quận\/huyện/i }).count(),
    ).toBe(0);
    await page.getByRole("combobox", { name: "Tỉnh/thành phố" }).click();
    await page
      .getByRole("option", { name: "Thành phố Bắc Ninh", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Phường/xã" }).click();
    await page
      .getByRole("option", { name: "Phường Bắc Giang", exact: true })
      .click();
    await page.getByLabel(/Số nhà, tên đường/).fill("123 Lê Lợi");
    await expect(page.getByTestId("address-summary")).toContainText(
      "Phường Bắc Giang, Thành phố Bắc Ninh",
    );
    await page.getByRole("button", { name: /xác nhận đặt hàng/i }).click();
    await expect(page).toHaveURL(/\/orders\/guest\//);
    const order = await prisma.order.findFirstOrThrow({
      where: { contactPhone: phone },
    });
    expect(order.deliveryProvince).toBe("Thành phố Bắc Ninh");
    expect(order.deliveryWard).toBe("Phường Bắc Giang");
    expect(order.deliveryDistrict).toBeNull();
    expect(order.deliveryAddress).toBe("123 Lê Lợi");
    await expect(
      page.getByRole("heading", { name: `Đơn ${order.code}`, exact: true }),
    ).toBeVisible();
  } finally {
    await prisma.$disconnect();
  }
});

test("tất cả trang quản trị trong sidebar mở được sau đăng nhập", async ({
  page,
}) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await expect(
    page.getByRole("complementary").locator('a[href="/admin/settings"]'),
  ).toBeVisible();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const destinations = await page
    .getByRole("complementary")
    .locator("a[href]")
    .evaluateAll((links) => [
      ...new Set(
        links
          .map((link) => link.getAttribute("href")!)
          .filter((href) => href.startsWith("/admin") || href === "/pos"),
      ),
    ]);
  expect(destinations.length).toBeGreaterThanOrEqual(10);
  destinations.push("/admin/reports");
  for (const path of destinations) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("complementary"), path).toBeVisible();
    await expect(page.getByRole("main"), path).not.toContainText(
      "Không tìm thấy trang",
    );
  }
  expect(errors).toEqual([]);
});

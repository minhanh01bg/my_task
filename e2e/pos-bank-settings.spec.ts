import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

test("lưu tài khoản ngân hàng rồi thanh toán chuyển khoản tại quầy", async ({
  page,
}) => {
  if (process.env.PLAYWRIGHT_PRODUCTION_DIR) {
    await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  }
  const prisma = new PrismaClient();
  const original = await prisma.setting.findMany();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  try {
    await page.goto("/login?next=%2Fadmin%2Fsettings");
    await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: "Vào bán hàng" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await page.locator("#bank-bin").fill("970423");
    await page.locator("#bank-account-number").fill("123456789");
    await page.locator("#bank-account-name").fill("NGUYEN VAN A");
    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(
      page.locator('[data-slot="toast"][data-type="success"]'),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Điều hướng quản lý", exact: true })
      .getByRole("link", { name: "Quầy bán hàng" })
      .click();
    await page.getByRole("combobox").fill("nhot");
    await page
      .getByRole("option")
      .getByText("Nhớt Castrol Power1 0.8L")
      .click();
    await page.getByRole("button", { name: /thanh toán/i }).click();
    await page.getByRole("tab", { name: "Chuyển khoản" }).click();
    await expect(page.getByText("NGUYEN VAN A — 123456789")).toBeVisible();
    await expect
      .poll(() =>
        page.getByTestId("vietqr-canvas").evaluate((node) => {
          const canvas = node as HTMLCanvasElement;
          return canvas
            .getContext("2d")!
            .getImageData(0, 0, canvas.width, canvas.height)
            .data.some((value, index) => index % 4 !== 3 && value > 0);
        }),
      )
      .toBe(true);
    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/orders") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Đã nhận tiền", exact: true })
      .click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const body = await response.json();
    const order = await prisma.order.findUnique({
      where: { code: body.order.code },
      include: { payments: true },
    });
    expect(order?.total).toBe(120000);
    expect(order?.payments[0].method).toBe("transfer");
    expect(order?.payments[0].receivedAt).not.toBeNull();
    expect(browserErrors).toEqual([]);
  } finally {
    // Chỉ khôi phục các cài đặt mà form này đã ghi; giữ nguyên bộ đếm đơn.
    const keys = [
      "store.name",
      "store.hotline",
      "store.address",
      "store.openingHours",
      "store.mapUrl",
      "bank.bin",
      "bank.accountNumber",
      "bank.accountName",
      "store.shippingFee",
      "store.freeShippingThreshold",
    ];
    for (const key of keys) {
      const entry = original.find((setting) => setting.key === key);
      if (entry)
        await prisma.setting.upsert({
          where: { key },
          create: entry,
          update: { value: entry.value },
        });
      else await prisma.setting.deleteMany({ where: { key } });
    }
    await prisma.$disconnect();
  }
});

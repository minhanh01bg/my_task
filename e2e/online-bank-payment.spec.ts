import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { saveProduct } from "@/server/products/save-product";

for (const mode of ["guest", "account"] as const) {
  test(`đơn online chuyển khoản có QR để khách thanh toán ngay (${mode})`, async ({
    page,
  }) => {
    const contactPhone = `09${String(Date.now()).slice(-8)}`;
    const prisma = new PrismaClient();
    const keys = ["bank.bin", "bank.accountNumber", "bank.accountName"];
    const original = await prisma.setting.findMany({
      where: { key: { in: keys } },
    });
    const headers: Record<string, string> = process.env
      .PLAYWRIGHT_PRODUCTION_DIR
      ? { "X-Real-IP": "1.1.1.1" }
      : {};
    await page.setExtraHTTPHeaders(headers);
    try {
      for (const [key, value] of [
        ["bank.bin", "970423"],
        ["bank.accountNumber", "123456789"],
        ["bank.accountName", "NGUYEN VAN A"],
      ]) {
        await prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        });
      }
      // Slug mới tránh HTML ISR của lần seed trước tham chiếu ID fixture đã xóa.
      const saved = await saveProduct({
        name: `Hàng kiểm tra chuyển khoản ${crypto.randomUUID().slice(0, 8)}`,
        unit: "cái",
        price: 120000,
        costPrice: 100000,
        stock: 10,
        isActive: true,
      });
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: saved.id },
      });
      if (mode === "account") {
        const phone = contactPhone;
        await page.goto("/account/register");
        await page.getByLabel("Họ và tên").fill("Khách kiểm tra");
        await page.getByLabel("Số điện thoại").fill(phone);
        await page
          .getByLabel("Mật khẩu", { exact: true })
          .fill("matkhau123456");
        await page.getByRole("button", { name: /tạo tài khoản/i }).click();
        await expect(page.getByText(/tài khoản đã được xử lý/i)).toBeVisible();
        await page.goto("/account/login");
        await page.getByLabel("Số điện thoại").fill(phone);
        await page
          .getByLabel("Mật khẩu", { exact: true })
          .fill("matkhau123456");
        await page.getByRole("button", { name: /^đăng nhập$/i }).click();
        await expect(page).toHaveURL(/\/account\/orders$/);
      }
      await page.goto(`/shop/p/${product.slug}`);
      await page.getByRole("button", { name: "Mua ngay", exact: true }).click();
      await expect(page).toHaveURL(/\/checkout$/);
      await page
        .getByLabel("Họ và tên", { exact: true })
        .fill("Khách kiểm tra");
      await page
        .getByLabel("Số điện thoại", { exact: true })
        .fill(contactPhone);
      await page.getByLabel("Nhận tại cửa hàng", { exact: true }).check();
      await page.getByLabel("Chuyển khoản thủ công", { exact: true }).check();
      const responsePromise = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/online/orders") &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Xác nhận đặt hàng", exact: true })
        .click();
      const response = await responsePromise;
      expect(response.status()).toBe(201);
      const body = await response.json();
      const target = body.data.order.accessUrl ?? body.data.order.receiptUrl;
      await expect(page).toHaveURL((url) => url.pathname === target);
      await expect(
        page.getByRole("heading", { name: "Thanh toán chuyển khoản" }),
      ).toBeVisible();
      await expect(page.getByText("NGUYEN VAN A — 123456789")).toBeVisible();
      await expect(page.getByTestId("vietqr-canvas")).toBeVisible();
      await expect
        .poll(() =>
          page.getByTestId("vietqr-canvas").evaluate((node) => {
            const canvas = node as HTMLCanvasElement;
            const pixels = canvas
              .getContext("2d")!
              .getImageData(0, 0, canvas.width, canvas.height).data;
            return pixels.some(
              (value, index) => index % 4 !== 3 && value === 255,
            );
          }),
        )
        .toBe(true);
      await expect(
        page.getByText(body.data.order.code, { exact: true }),
      ).toHaveCount(1);
      await expect(
        page.getByText(
          /chỉ xác nhận đã thanh toán khi cửa hàng nhận được tiền/i,
        ),
      ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      if (body.data.order.receiptUrl) {
        await page.goto(body.data.order.receiptUrl);
        await expect(
          page.getByRole("heading", { name: "Thanh toán chuyển khoản" }),
        ).toBeVisible();
      }
      await prisma.order.update({
        where: { code: body.data.order.code },
        data: { status: "paid" },
      });
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Thanh toán chuyển khoản" }),
      ).toHaveCount(0);
    } finally {
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
}

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { hashCustomerPassword } from "@/server/customer-auth/password";
import { digestOpaqueToken } from "@/server/customer-auth/session";

test("lưu đơn giữ đường dẫn qua login/register và đơn xuất hiện trong lịch sử riêng", async ({
  page,
}) => {
  if (process.env.PLAYWRIGHT_PRODUCTION_DIR)
    await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  const prisma = new PrismaClient();
  const token = crypto.randomUUID();
  const phone = `09${String(Date.now()).slice(-8)}`;
  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized: `+84${phone.slice(1)}`,
      displayName: "Khách lưu đơn",
      passwordHash: await hashCustomerPassword("matkhau123456"),
      phoneVerifiedAt: new Date(),
    },
  });
  const order = await prisma.order.create({
    data: {
      code: `CLAIM-${token}`,
      clientId: token,
      channel: "online",
      contactPhone: phone,
      guestAccess: {
        create: {
          tokenHash: digestOpaqueToken(token),
          expiresAt: new Date(Date.now() + 86400000),
        },
      },
    },
  });
  try {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account\/login$/);
    await page.goto(`/orders/guest/${token}`);
    await page
      .getByRole("button", { name: "Lưu đơn hàng vào tài khoản của bạn" })
      .click();
    await expect(page).toHaveURL(
      `/account/login?next=${encodeURIComponent(`/orders/guest/${token}`)}`,
    );
    await page.getByRole("link", { name: "Đăng ký", exact: true }).click();
    await expect(page).toHaveURL(
      `/account/register?next=${encodeURIComponent(`/orders/guest/${token}`)}`,
    );
    await page.getByRole("link", { name: "Đăng nhập", exact: true }).click();
    await page.getByLabel("Số điện thoại").fill(phone);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("matkhau123456");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(`/orders/guest/${token}`);
    await prisma.customerAccount.update({
      where: { id: account.id },
      data: { phoneVerifiedAt: null },
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Lưu đơn hàng vào tài khoản của bạn" }),
    ).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText(/xác minh số điện thoại/);
    await prisma.customerAccount.update({
      where: { id: account.id },
      data: { phoneVerifiedAt: new Date() },
    });
    await page.reload();
    await page
      .getByRole("button", { name: "Lưu đơn hàng vào tài khoản của bạn" })
      .click();
    await expect(page).toHaveURL(`/account/orders/${order.id}`);
    await expect(
      page.getByRole("heading", { name: `Đơn ${order.code}` }),
    ).toBeVisible();
    await page.goto("/account/orders");
    await expect(page.getByText(order.code, { exact: true })).toBeVisible();
    await page.goto(`/orders/guest/${token}`);
    await expect(
      page.getByRole("heading", { name: "Không tìm thấy trang" }),
    ).toBeVisible();
  } finally {
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.customerAccount.delete({ where: { id: account.id } });
    await prisma.$disconnect();
  }
});

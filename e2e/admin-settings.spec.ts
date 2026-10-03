import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("admin mở được cài đặt có dữ liệu cũ sai định dạng để sửa", async ({
  page,
}) => {
  const prisma = new PrismaClient();
  const legacy = [
    { key: "store.name", value: "x".repeat(101) },
    { key: "store.hotline", value: "123" },
    { key: "store.mapUrl", value: "https://" },
  ];
  const original = await prisma.setting.findMany({
    where: { key: { in: legacy.map((entry) => entry.key) } },
  });
  try {
    for (const entry of legacy) {
      await prisma.setting.upsert({
        where: { key: entry.key },
        create: entry,
        update: { value: entry.value },
      });
    }
    await page.goto("/login?next=%2Fadmin%2Fsettings");
    await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: "Vào bán hàng" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/, { timeout: 15_000 });
    await expect(page.locator("#store-name")).toHaveValue(legacy[0].value);
    await expect(page.locator("#store-hotline")).toHaveValue("123");
    await expect(page.locator("#store-map-url")).toHaveValue("https://");
    await expect(page.getByText("Không thể tải trang quản lý")).toHaveCount(0);
  } finally {
    for (const entry of legacy) {
      const previous = original.find((record) => record.key === entry.key);
      if (previous) {
        await prisma.setting.update({
          where: { key: entry.key },
          data: { value: previous.value },
        });
      } else {
        await prisma.setting.deleteMany({ where: { key: entry.key } });
      }
    }
    await prisma.$disconnect();
  }
});

test("lưu cài đặt hiện toast ở vị trí đang cuộn và khi lưu lại", async ({
  page,
}) => {
  const prisma = new PrismaClient();
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
  const original = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });
  try {
    await page.goto("/login?next=%2Fadmin%2Fsettings");
    await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
    await page.getByRole("button", { name: "Vào bán hàng" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/, { timeout: 15_000 });
    await page.locator("#store-name").fill("Cửa hàng kiểm tra");
    await page.locator("#store-hotline").fill("");
    await page.locator("#store-map-url").fill("");
    await page.locator("#bank-bin").fill("970423");
    await page.locator("#bank-account-number").fill("123456");
    await page.locator("#bank-account-name").fill("NGUYEN VAN A");
    const save = page.getByRole("button", { name: "Lưu cài đặt" });
    await save.click();
    const toast = page.locator('[data-slot="toast"][data-type="success"]');
    await expect(toast).toHaveCount(1);
    await expect(toast.first()).toBeInViewport();
    await save.click();
    await expect(toast).toHaveCount(2);
    await expect(toast.last()).toBeInViewport();
  } finally {
    for (const key of keys) {
      const previous = original.find((entry) => entry.key === key);
      if (previous)
        await prisma.setting.upsert({
          where: { key },
          create: previous,
          update: { value: previous.value },
        });
      else await prisma.setting.deleteMany({ where: { key } });
    }
    await prisma.$disconnect();
  }
});

import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const prisma = new PrismaClient();
const name = `Kiểm tra danh mục ${randomUUID().slice(0, 8)}`;

test.afterAll(async () => {
  await prisma.category.deleteMany({ where: { name: { startsWith: name } } });
  await prisma.$disconnect();
});

test("danh mục: lỗi tại ô nhập, thêm, sửa và bố cục điện thoại", async ({
  page,
}) => {
  if (process.env.PLAYWRIGHT_PRODUCTION_DIR)
    await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await page.goto("/admin/categories");
  const create = page.getByRole("form", { name: "Thêm danh mục", exact: true });
  const input = create.getByRole("textbox");
  await input.fill("   ");
  await create.getByRole("button").click();
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(create.getByRole("alert")).toContainText("Vui lòng nhập");
  await input.fill(name);
  await expect(create.getByRole("alert")).toHaveCount(0);
  await create.getByRole("button").click();
  await expect(
    page.getByText("Đã thêm danh mục.", { exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue("");
  const edit = page.getByRole("form", {
    name: `Sửa danh mục ${name}`,
    exact: true,
  });
  await expect(edit).toBeVisible();
  const saved = await prisma.category.findFirstOrThrow({ where: { name } });
  await edit.getByRole("textbox").fill(`${name} mới`);
  await edit.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(
    page.getByText("Đã lưu danh mục.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: `Tên danh mục ${name} mới`,
      exact: true,
    }),
  ).toHaveValue(`${name} mới`);
  expect(
    (await prisma.category.findUniqueOrThrow({ where: { id: saved.id } })).slug,
  ).toBe(saved.slug);
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(create.getByRole("button")).toBeVisible();
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/categories");
  await page.screenshot({ path: "/tmp/category-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/category-mobile.png", fullPage: true });
});

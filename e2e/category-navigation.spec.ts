import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const prisma = new PrismaClient();
const categoryId = `e2e-category-pagination-${randomUUID()}`;
const slug = categoryId;
const path = `/shop/c/${slug}`;

async function cleanup() {
  await prisma.product.deleteMany({ where: { categoryId } });
  await prisma.category.deleteMany({ where: { id: categoryId } });
}

test.beforeAll(async () => {
  await cleanup();
  await prisma.category.create({
    data: { id: categoryId, name: "Danh mục phân trang E2E", slug },
  });
  await prisma.product.createMany({
    data: Array.from({ length: 25 }, (_, index) => ({
      name: `Sản phẩm phân trang ${String(index).padStart(2, "0")}`,
      slug: `${slug}-product-${index}`,
      categoryId,
      price: 10_000,
      stock: 5,
    })),
  });
});

test.afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("đăng nhập admin tải chunk và hydrate form không có lỗi 500", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500)
      errors.push(`${response.status()} ${response.url()}`);
  });
  expect((await page.goto("/login?next=%2Fadmin"))?.status()).toBe(200);
  const password = page.getByLabel("Mật khẩu cửa hàng");
  await password.fill("Kiểm tra giao diện");
  await page
    .getByRole("button", { name: "Hiện mật khẩu", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "text");
  await password.fill("");
  await page.getByRole("button", { name: "Vào bán hàng" }).click();
  await expect(
    page.getByText("Vui lòng nhập mật khẩu cửa hàng.", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("danh mục ISR: mở trực tiếp, chuyển trang và giữ URL query không lỗi 500", async ({
  page,
}) => {
  const serverErrors: string[] = [];
  page.on("response", (response) => {
    if (
      new URL(response.url()).pathname.startsWith(path) &&
      response.status() >= 500
    )
      serverErrors.push(`${response.status()} ${response.url()}`);
  });
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "Danh mục phân trang E2E" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sản phẩm phân trang 00", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sản phẩm phân trang 24", { exact: true }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Trang sau" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}[?]page=2$`));
  await expect(page.getByText("Trang 2/2", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Sản phẩm phân trang 24", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sản phẩm phân trang 00", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`${path}[?]page=2$`),
  );
  await page.reload();
  await expect(page.getByText("Trang 2/2", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Trang trước" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}[?]page=1$`));
  await expect(
    page.getByText("Sản phẩm phân trang 00", { exact: true }),
  ).toBeVisible();
  expect(serverErrors).toEqual([]);
});

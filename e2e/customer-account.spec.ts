import { expect, test } from "@playwright/test";

test("customer auth namespace không thay đổi bảo vệ admin", async ({
  page,
}) => {
  await page.goto("/account/register");
  await expect(
    page.getByRole("heading", { name: "Tạo tài khoản" }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("guest order code không phải capability", async ({ page }) => {
  await page.goto("/orders/guest/not-an-order-capability");
  await expect(
    page.getByRole("heading", { name: /page not found/i }),
  ).toBeVisible();
});

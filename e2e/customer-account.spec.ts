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

test("customer notification hiển thị thông báo trong tài khoản khách hàng", async ({
  page,
}) => {
  const phone = `09${Math.floor(10000000 + Math.random() * 90000000)}`;
  await page.goto("/account/register");
  await page.getByLabel("Họ và tên").fill("Khách Hàng Test");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Mật khẩu").fill("matkhau123456");
  await page.getByRole("button", { name: /tạo tài khoản/i }).click();

  await expect(page.getByText(/tài khoản đã được xử lý/i)).toBeVisible();
  await page.getByRole("link", { name: /đăng nhập ngay/i }).click();
  await page.waitForURL("**/account/login");

  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Mật khẩu").fill("matkhau123456");
  await page.getByRole("button", { name: /^đăng nhập$/i }).click();
  await page.waitForURL("**/account/orders");

  // Verify customer notification button is visible
  const notifBtn = page.getByRole("button", { name: /thông báo/i });
  await expect(notifBtn).toBeVisible();

  // Open notification panel
  await notifBtn.click();
  const panel = page.getByRole("region", { name: /hộp thư thông báo/i });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Chưa có thông báo")).toBeVisible();
});

import { expect, test } from "@playwright/test";

import { STORE_PASSWORD } from "./credentials";

test("đăng nhập khách có validation riêng và không tràn màn hình", async ({
  page,
}) => {
  await page.goto("/account/login");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Vui lòng nhập số điện thoại.")).toBeVisible();
  await expect(page.getByText("Vui lòng nhập mật khẩu.")).toBeVisible();
  await expect(page.getByLabel("Số điện thoại")).toBeFocused();
  await page.getByLabel("Số điện thoại").fill("abc");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Số điện thoại không hợp lệ.")).toBeVisible();
  await expect(
    page.getByText("Mật khẩu cần từ 10 đến 128 ký tự."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Khám phá sản phẩm" }),
  ).toHaveAttribute("href", "/shop");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/customer-login-${width}.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: /chuyển sang giao diện tối|đổi giao diện/i })
    .click();
  await page.screenshot({
    path: "/tmp/customer-login-dark.png",
    fullPage: true,
  });
});

test("từ trang khách có thể bấm vào quản trị và đăng nhập", async ({
  page,
}) => {
  await page.goto("/account/login");
  await page.getByRole("link", { name: "Đăng nhập quản trị" }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await page.getByRole("button", { name: "Vào bán hàng" }).click();
  await expect(
    page.getByText("Vui lòng nhập mật khẩu cửa hàng."),
  ).toBeVisible();
  await page.getByLabel("Mật khẩu cửa hàng").fill(STORE_PASSWORD);
  await page.getByRole("button", { name: "Vào bán hàng" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15000 });
});

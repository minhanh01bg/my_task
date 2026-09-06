import { expect, test } from "@playwright/test";

test("admin có app shell mobile rõ ràng và menu đầy đủ truy cập được", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  const loginButton = page.getByRole("button", { name: /vào bán hàng/i });
  await expect(loginButton).toBeEnabled();
  await loginButton.click();
  await page.waitForURL("**/pos");
  await page.goto("/admin/orders");

  await expect(page.getByText("Quản lý", { exact: true })).toBeVisible();
  const mobileNav = page.getByRole("navigation", {
    name: "Điều hướng quản lý trên điện thoại",
  });
  await expect(mobileNav).toBeVisible();
  await expect(
    mobileNav.getByRole("link", { name: "Đơn hàng" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Điều hướng quản lý", exact: true }),
  ).toBeHidden();

  const mainPaddingBottom = await page
    .locator("#admin-main-content")
    .evaluate((node) =>
      Number.parseFloat(getComputedStyle(node).paddingBottom),
    );
  const mobileNavHeight = await mobileNav.evaluate(
    (node) => node.getBoundingClientRect().height,
  );
  expect(mainPaddingBottom).toBeGreaterThan(mobileNavHeight);

  const menuTrigger = mobileNav.getByRole("button", {
    name: "Mở toàn bộ menu quản lý",
  });
  await menuTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Menu quản lý" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Công nợ" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(menuTrigger).toBeFocused();

  await page.getByRole("button", { name: /^Thông báo/ }).click();
  await expect(
    page.getByRole("region", { name: "Thông báo quản trị" }),
  ).toBeVisible();
});

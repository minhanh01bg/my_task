import { expect, test } from "@playwright/test";

import { STORE_PASSWORD } from "./credentials";

test("các trang chính không tràn ngang ở màn hình điện thoại", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Mật khẩu cửa hàng" })
    .fill(STORE_PASSWORD);
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  for (const path of ["/", "/shop", "/account/login", "/login"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `${path} tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);
  }

  for (const path of [
    "/pos",
    "/admin",
    "/admin/products",
    "/admin/orders",
    "/admin/reports",
    "/admin/settings",
  ]) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    const offenders =
      overflow > 1
        ? await page.evaluate(() =>
            [...document.querySelectorAll("body *")]
              .filter(
                (element) =>
                  element.getBoundingClientRect().right > window.innerWidth + 1,
              )
              .slice(0, 8)
              .map(
                (element) =>
                  `${element.tagName}.${element.className?.toString().slice(0, 80)}`,
              ),
          )
        : [];
    expect(
      overflow,
      `${path} tràn ngang ${overflow}px: ${offenders.join(", ")}`,
    ).toBeLessThanOrEqual(1);
  }
});

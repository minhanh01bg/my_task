import { expect, test } from "@playwright/test";

test("trang goc chuyen huong vinh vien sang cua hang", async ({ page }) => {
  // "/" la diem vao cong khai: redirect 308 (next.config.ts) sang /shop.
  // POS van o /pos va chi mo sau dang nhap.
  const response = await page.request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toMatch(/\/shop$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/shop$/);
});

import { expect, test } from "@playwright/test";

test("trang goc dua thang vao man hinh ban hang", async ({ page }) => {
  // "/" khong con la trang gioi thieu cua template — Plan 1 doi no thanh
  // redirect sang /pos, va /pos chua dang nhap thi bi day ve /login.
  await page.goto("/");
  await page.waitForURL(/\/(login|pos)$/);
  await expect(page).toHaveURL(/\/login$/);
});

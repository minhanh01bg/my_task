import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
  await expect(page.locator("#admin-desktop-sidebar")).toBeVisible();
});

test("thu mở chạy qua kích thước trung gian và navbar/content đi cùng sidebar", async ({
  page,
}) => {
  const sidebar = page.locator("#admin-desktop-sidebar");
  const header = page.getByRole("banner");
  const settings = sidebar.getByRole("link", { name: "Cài đặt", exact: true });
  await settings.focus();
  const samples = await page.evaluate(async () => {
    const sidebar = document.querySelector<HTMLElement>(
      "#admin-desktop-sidebar",
    )!;
    const toggle = document.querySelector<HTMLButtonElement>(
      'button[aria-controls="admin-desktop-sidebar"]',
    )!;
    toggle.click();
    const samples = [];
    for (let i = 0; i < 8; i++) {
      await new Promise(requestAnimationFrame);
      samples.push({
        width: sidebar.getBoundingClientRect().width,
        headerX: document.querySelector("header")!.getBoundingClientRect().x,
        mainX: document
          .querySelector("#admin-main-content")!
          .getBoundingClientRect().x,
      });
    }
    return samples;
  });
  await expect(settings).toBeFocused();
  expect(
    samples.some((sample) => sample.width > 73 && sample.width < 249),
  ).toBe(true);
  for (const sample of samples) {
    expect(Math.abs(sample.width - sample.headerX)).toBeLessThan(1);
    expect(Math.abs(sample.width - sample.mainX)).toBeLessThan(1);
  }
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(72);
  // Đảo chiều liên tiếp phải kết thúc ở trạng thái cuối, không chờ animationend.
  await page.evaluate(() => {
    const toggle = document.querySelector<HTMLButtonElement>(
      'button[aria-controls="admin-desktop-sidebar"]',
    )!;
    toggle.click();
  });
  await expect(sidebar).not.toHaveAttribute("data-compact");
  await header
    .getByRole("button", { name: "Thu gọn thanh điều hướng" })
    .click();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(72);
  await header
    .getByRole("button", { name: "Mở rộng thanh điều hướng" })
    .click();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(250);
  const handle = page.getByRole("separator", {
    name: "Thay đổi chiều rộng thanh điều hướng",
  });
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(320, box.y + 100);
  expect((await sidebar.boundingBox())!.width).toBe(320);
  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("admin-sidebar-width")),
    )
    .toBe("320");
});

test("giảm chuyển động thu gọn tức thì và giữ tên menu truy cập được", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const sidebar = page.locator("#admin-desktop-sidebar");
  await page.getByRole("button", { name: "Thu gọn thanh điều hướng" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(72);
  expect(
    await sidebar.evaluate((node) =>
      parseFloat(getComputedStyle(node).transitionDuration),
    ),
  ).toBeLessThanOrEqual(0.001);
  await expect(
    sidebar.getByRole("link", { name: "Cài đặt", exact: true }),
  ).toBeVisible();
});

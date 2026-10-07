import { expect, test } from "@playwright/test";

for (const width of [1440, 390, 320]) {
  test(`storefront Spectra at ${width}px has real product navigation and usable keyboard controls`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/shop");
    const hero = page.getByRole("region", { name: "Slider Spectra" });
    await expect(hero).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(hero.getByRole("heading", { level: 1 })).toHaveText(
      "Điều bạn cần.Ngay ở đây.",
    );
    await expect(
      page.getByRole("navigation", { name: "Chọn phương án slider" }),
    ).toHaveCount(0);
    await expect(page.getByText("Bản xem trước · Chờ duyệt")).toHaveCount(0);
    await expect
      .poll(() =>
        hero
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    const buy = hero.getByRole("link", { name: "Mua ngay", exact: true });
    const initial = await buy.getAttribute("href");
    await hero.getByRole("button", { name: "Sản phẩm tiếp theo" }).click();
    await expect(buy).not.toHaveAttribute("href", initial!);
    await hero.focus();
    await page.keyboard.press("Tab");
    await expect(hero.locator('button[data-offset="0"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(buy).toBeFocused();
    expect(
      await hero
        .getByRole("button", { name: "Sản phẩm tiếp theo" })
        .evaluate((element) => getComputedStyle(element).width),
    ).toBe("44px");
    await page.screenshot({
      path: `/tmp/storefront-spectra-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    const selected = await buy.getAttribute("href");
    await buy.click();
    await expect(page).toHaveURL(new RegExp(selected! + "$"));
    await expect(
      page.getByRole("button", { name: /thêm vào giỏ/i }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

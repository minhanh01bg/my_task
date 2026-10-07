import { expect, test } from "@playwright/test";

const variants = [
  { id: "spectra", name: "Spectra" },
  { id: "spotlight", name: "Spotlight" },
  { id: "under-the-radar", name: "Under The Radar" },
];

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Real-IP": "1.1.1.1" });
});

for (const variant of variants) {
  test(`${variant.name}: real images, card selection, navigation and responsive swipe`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(`/shop/slider-preview/${variant.id}`);
    const hero = page.getByRole("region", { name: `Slider ${variant.name}` });
    await expect(hero).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      page
        .getByRole("navigation", { name: "Chọn phương án slider" })
        .getByRole("link", { name: new RegExp(variant.name) }),
    ).toHaveAttribute("aria-current", "page");
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
    await page.screenshot({
      path: `/tmp/slider-preview-${variant.id}-desktop.png`,
      fullPage: true,
      animations: "disabled",
    });
    const buy = hero.getByRole("link", { name: "Mua ngay", exact: true });
    const firstHref = await buy.getAttribute("href");
    await hero.getByRole("button", { name: /^Xem / }).nth(1).click();
    await expect(buy).not.toHaveAttribute("href", firstHref!);
    await expect(buy).toHaveAttribute("href", /^\/shop\/(p|products)\//);
    await expect(
      hero.getByRole("link", { name: "Xem danh mục" }),
    ).toHaveAttribute("href", /^\/shop/);
    await hero.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(buy).toHaveAttribute("href", firstHref!);
    await page.keyboard.press("Tab");
    await expect(hero.locator('button[data-offset="0"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(buy).toBeFocused();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      const next = hero.getByRole("button", { name: "Sản phẩm tiếp theo" });
      await next.scrollIntoViewIfNeeded();
      const bounds = await next.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: `/tmp/slider-preview-${variant.id}-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
    }
    const stage = hero.locator('[aria-label="Ảnh sản phẩm"]');
    await stage.scrollIntoViewIfNeeded();
    const bounds = await stage.boundingBox();
    await page.mouse.move(
      bounds!.x + bounds!.width * 0.75,
      bounds!.y + bounds!.height * 0.5,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds!.x + bounds!.width * 0.25,
      bounds!.y + bounds!.height * 0.5,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(buy).not.toHaveAttribute("href", firstHref!);
    expect(errors).toEqual([]);
  });
}

test("switches all three previews and returns to the Spectra storefront", async ({
  page,
}) => {
  await page.goto("/shop/slider-preview");
  await expect(page).toHaveURL(/\/shop\/slider-preview\/spectra$/);
  for (const variant of variants) {
    await page
      .getByRole("navigation", { name: "Chọn phương án slider" })
      .getByRole("link", { name: new RegExp(variant.name) })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/shop/slider-preview/${variant.id}$`),
    );
    await expect(
      page.getByRole("region", { name: `Slider ${variant.name}` }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "Về cửa hàng" }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(
    page.getByRole("region", { name: "Slider Spectra" }),
  ).toBeVisible();
});

test("reduced motion keeps the scene still and manual next remains available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shop/slider-preview/spectra");
  const hero = page.getByRole("region", { name: "Slider Spectra" });
  await expect(
    hero.getByRole("button", { name: "Bật tự chạy" }),
  ).toBeDisabled();
  const firstHref = await hero
    .getByRole("link", { name: "Mua ngay", exact: true })
    .getAttribute("href");
  await hero.getByRole("button", { name: "Sản phẩm tiếp theo" }).click();
  await expect(
    hero.getByRole("link", { name: "Mua ngay", exact: true }),
  ).not.toHaveAttribute("href", firstHref!);
  expect(
    await hero
      .getByRole("button", { name: /^Xem / })
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration),
  ).toBe("0s");
});

test("unknown preview does not render a broken design", async ({ page }) => {
  const response = await page.goto("/shop/slider-preview/unknown-style");
  expect(response?.status()).toBe(404);
});

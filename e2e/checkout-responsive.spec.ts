import { expect, test, type Page } from "@playwright/test";

const PRODUCT_NAME =
  "Combo nhu yếu phẩm gia đình gạo, dầu ăn và nước giặt dành cho cả tháng";

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
    )
    .toBeLessThanOrEqual(1);
  for (const element of await page
    .locator(
      "main input:not([aria-hidden=true]):visible, main textarea:visible, main button:visible",
    )
    .all()) {
    const bounds = await element.boundingBox();
    expect(bounds).not.toBeNull();
    if (await element.evaluate((node) => node.tagName === "BUTTON")) {
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width + 1,
    );
  }
}

test.beforeEach(async ({ page }) => {
  // Local cart only: these layout checks never create real orders or alter stock.
  await page.addInitScript((name) => {
    localStorage.setItem(
      "online-cart-v1",
      JSON.stringify([
        {
          id: "checkout-layout-fixture",
          name,
          price: 150000,
          quantity: 2,
          stock: 99,
          unit: "combo",
          imageUrl: null,
          categoryId: null,
          searchText: "",
        },
      ]),
    );
  }, PRODUCT_NAME);
});

for (const width of [320, 360, 390, 768, 1024, 1440]) {
  test(`checkout fits ${width}px through address, pickup and cart changes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/checkout");
    await expect(
      page.getByRole("heading", { name: "Thông tin đặt hàng" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Xác nhận đặt hàng" }),
    ).toBeEnabled();
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("combobox", { name: "Tỉnh/thành phố" })
      .fill("bac ninh");
    const popup = page.locator('[data-slot="address-options"]');
    await expect(popup).toBeVisible();
    const bounds = await popup.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await page
      .getByRole("option", { name: "Thành phố Bắc Ninh", exact: true })
      .click();
    await page.getByRole("combobox", { name: "Phường/xã" }).fill("bac giang");
    await page
      .getByRole("option", { name: "Phường Bắc Giang", exact: true })
      .click();
    await page
      .getByLabel(/Số nhà, tên đường/)
      .fill("123 đường Lê Lợi, khu dân cư trung tâm");
    await expect(page.getByTestId("address-summary")).toContainText(
      "Phường Bắc Giang",
    );
    await page.getByRole("combobox", { name: "Khung giờ giao" }).click();
    await page.getByRole("option", { name: /18:00 - 21:00/ }).click();
    await expectNoHorizontalOverflow(page);

    await page
      .getByRole("button", { name: "Nhập thủ công", exact: true })
      .click();
    await page.getByLabel("Tỉnh/thành phố").fill("Thành phố Bắc Ninh");
    await page.getByLabel("Phường/xã").fill("Phường Bắc Giang");
    await page
      .getByLabel(/Số nhà, tên đường/)
      .fill("ĐịaChỉLiềnMạch".repeat(12));
    await expectNoHorizontalOverflow(page);

    await page.getByLabel("Chuyển khoản thủ công", { exact: true }).check();
    await expect(
      page.getByLabel("Chuyển khoản thủ công", { exact: true }),
    ).toBeChecked();
    await page.getByLabel("Nhận tại cửa hàng", { exact: true }).check();
    await expect(page.getByTestId("pickup-store-info")).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Khung giờ giao" }),
    ).toHaveCount(0);
    await page
      .getByRole("spinbutton", { name: `Số lượng ${PRODUCT_NAME}` })
      .fill("3");
    await expect(page.locator("aside")).toContainText("450.000 ₫");
    await expectNoHorizontalOverflow(page);

    const confirm = page.getByRole("button", { name: "Xác nhận đặt hàng" });
    await confirm.scrollIntoViewIfNeeded();
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.getByRole("button", { name: "Xóa", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Giỏ hàng đang trống" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}

test("mobile checkout applies voucher and retains details after a rejected order", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/checkout");
  await page.getByLabel("Họ và tên", { exact: true }).fill("Khách kiểm thử");
  await page.getByLabel("Số điện thoại", { exact: true }).fill("0987654321");
  await page.getByLabel("Nhận tại cửa hàng", { exact: true }).check();
  await page.getByLabel(/Mã ưu đãi/).fill("GIAM10");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await expect(page.getByText(/Đã áp dụng mã GIAM10/)).toBeVisible();
  await expect(page.locator("aside")).toContainText("270.000 ₫");
  await expectNoHorizontalOverflow(page);

  // Deliberate API rejection: exercise real form serialization without writing an order.
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/online/orders", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        message: "Sản phẩm đã thay đổi, vui lòng kiểm tra lại đơn hàng.",
      }),
    });
  });
  await page.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Sản phẩm đã thay đổi",
  );
  expect(submitted).toMatchObject({
    contactName: "Khách kiểm thử",
    contactPhone: "0987654321",
    fulfillmentType: "pickup",
    paymentMethod: "cod",
    voucherCode: "GIAM10",
    lines: [{ productId: "checkout-layout-fixture", quantity: 2 }],
  });
  await expect(page.getByLabel("Họ và tên", { exact: true })).toHaveValue(
    "Khách kiểm thử",
  );
  await expect(
    page.getByRole("button", { name: "Xác nhận đặt hàng" }),
  ).toBeEnabled();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Gỡ mã", exact: true }).click();
  await expect(page.locator("aside")).toContainText("300.000 ₫");
  await expectNoHorizontalOverflow(page);
});

test("address search handles keyboard, empty results and province changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/checkout");
  const province = page.getByRole("combobox", { name: "Tỉnh/thành phố" });
  const ward = page.getByRole("combobox", { name: "Phường/xã" });
  await expect(ward).toBeDisabled();
  await province.fill("  BAC   NINH  ");
  await expect(page.getByRole("option")).toHaveCount(1);
  await province.press("ArrowDown");
  await province.press("Enter");
  await expect(province).toHaveValue("Thành phố Bắc Ninh");
  await ward.fill("dong ky");
  await page.getByRole("option", { name: "Xã Đồng Kỳ", exact: true }).click();
  await province.fill("");
  await expect(ward).toBeDisabled();
  await expect(ward).toHaveValue("");
  await province.fill("khongtontai");
  await expect(page.getByText("Không tìm thấy địa chỉ phù hợp.")).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
  await province.fill("ha noi");
  await page
    .getByRole("option", { name: "Thành phố Hà Nội", exact: true })
    .click();
  await ward.fill("bac giang");
  await expect(page.getByText("Không tìm thấy địa chỉ phù hợp.")).toBeVisible();
  await ward.fill("ba dinh");
  await page
    .getByRole("option", { name: "Phường Ba Đình", exact: true })
    .click();
  await page.getByLabel(/Số nhà, tên đường/).fill("12 Lê Lợi");
  await expect(page.getByTestId("address-summary")).toContainText(
    "Phường Ba Đình, Thành phố Hà Nội",
  );
  await expectNoHorizontalOverflow(page);
});

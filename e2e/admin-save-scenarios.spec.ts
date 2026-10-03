import { PrismaClient } from "@prisma/client";
import { expect, test, type Page, type Route } from "@playwright/test";

// Cac ca doi cau hinh chung; chay tuan tu va khoi phuc fixture sau moi ca.
test.describe.configure({ mode: "default" });
const prisma = new PrismaClient();
const settingsKeys = [
  "store.name",
  "store.hotline",
  "store.address",
  "store.openingHours",
  "store.mapUrl",
  "bank.bin",
  "bank.accountNumber",
  "bank.accountName",
  "store.shippingFee",
  "store.freeShippingThreshold",
];
let settingsBefore: { key: string; value: string }[];
let settingsFieldsBefore: Record<string, string> | null;
const prefix = "QA thông báo lưu";

async function login(page: Page, path: string) {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel("Mật khẩu cửa hàng").fill("123456");
  await page.getByRole("button", { name: "Vào bán hàng" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`), { timeout: 15_000 });
}

async function fillSettings(page: Page) {
  settingsFieldsBefore = await page
    .locator("form input[id]")
    .evaluateAll((inputs) =>
      Object.fromEntries(
        inputs.map((input) => [input.id, (input as HTMLInputElement).value]),
      ),
    );
  await page.locator("#store-name").fill(`${prefix} cửa hàng`);
  await page.locator("#store-hotline").fill("0901234567");
  await page.locator("#store-map-url").fill("");
  await page.locator("#bank-bin").fill("970423");
  await page.locator("#bank-account-number").fill("123456789");
  await page.locator("#bank-account-name").fill("NGUYEN VAN A");
  await page.locator("#shipping-fee").fill("25000");
  await page.locator("#free-shipping-threshold").fill("300000");
}

async function openCreate(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Thêm sản phẩm", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Thêm sản phẩm mới" });
  await dialog.getByLabel("Tên sản phẩm").fill(name);
  await dialog
    .getByRole("spinbutton", { name: "Giá bán", exact: true })
    .fill("7500");
  await dialog
    .getByRole("spinbutton", { name: "Số lượng tồn kho", exact: true })
    .fill("1.25");
  return dialog;
}

const failAction = async (route: Route) => {
  if (
    route.request().method() === "POST" &&
    route.request().headers()["next-action"]
  )
    await route.abort("failed");
  else await route.continue();
};

function toast(page: Page, type: "success" | "error") {
  return page.locator(`[data-slot="toast"][data-type="${type}"]`).last();
}

test.beforeEach(async () => {
  settingsFieldsBefore = null;
  settingsBefore = await prisma.setting.findMany({
    where: { key: { in: settingsKeys } },
  });
});

async function restoreSettingsRows() {
  for (const key of settingsKeys) {
    const old = settingsBefore.find((entry) => entry.key === key);
    if (old)
      await prisma.setting.upsert({
        where: { key },
        create: old,
        update: { value: old.value },
      });
    else await prisma.setting.deleteMany({ where: { key } });
  }
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await restoreSettingsRows();
  if (settingsFieldsBefore) {
    // Khoi phuc qua action de het han ca cache settings, roi tra lai cac khoa vong doi fixture.
    await page.goto("/admin/settings");
    for (const [id, value] of Object.entries(settingsFieldsBefore)) {
      await page.locator(`#${id}`).fill(value);
    }
    for (const [id, fallback] of Object.entries({
      "bank-bin": "970423",
      "bank-account-number": "123456",
      "bank-account-name": "NGUYEN VAN A",
    })) {
      if (!settingsFieldsBefore[id])
        await page.locator(`#${id}`).fill(fallback);
    }
    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(toast(page, "success")).toContainText(
      "Lưu cài đặt thành công",
    );
  }
  await restoreSettingsRows();
  await prisma.product.deleteMany({ where: { name: { startsWith: prefix } } });
});

test.afterAll(async () => prisma.$disconnect());

test("cài đặt: toast thành công đi cùng dữ liệu đã lưu sau tải lại", async ({
  page,
}) => {
  await login(page, "/admin/settings");
  await fillSettings(page);
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(toast(page, "success")).toContainText("Lưu cài đặt thành công");
  await expect
    .poll(
      async () =>
        (
          await prisma.setting.findUnique({
            where: { key: "store.shippingFee" },
          })
        )?.value,
    )
    .toBe("25000");
  await page.reload();
  await expect(page.locator("#store-name")).toHaveValue(`${prefix} cửa hàng`);
  await expect(page.locator("#bank-account-number")).toHaveValue("123456789");
  await expect(page.locator("#shipping-fee")).toHaveValue("25000");
  await expect(page.locator("#free-shipping-threshold")).toHaveValue("300000");
});

test("cài đặt: validation server báo lỗi, giữ nội dung và không ghi một phần", async ({
  page,
}) => {
  await login(page, "/admin/settings");
  await fillSettings(page);
  await page.locator("#bank-bin").fill("123");
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(toast(page, "error")).toContainText(
    "Mã ngân hàng phải là 6 chữ số",
  );
  await expect(toast(page, "success")).toHaveCount(0);
  await expect(page.locator("#store-name")).toHaveValue(`${prefix} cửa hàng`);
  await expect(page.locator("#bank-bin")).toHaveValue("123");
  expect(
    await prisma.setting.findMany({
      where: { key: { in: settingsKeys } },
      orderBy: { key: "asc" },
    }),
  ).toEqual([...settingsBefore].sort((a, b) => a.key.localeCompare(b.key)));
});

test("cài đặt: mất mạng báo lỗi an toàn, sửa được bằng lưu lại", async ({
  page,
}) => {
  await login(page, "/admin/settings");
  await fillSettings(page);
  await page.route("**/admin/settings", failAction);
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(toast(page, "error")).toContainText(
    "Không thể lưu cài đặt. Vui lòng thử lại.",
  );
  await expect(page.locator("#bank-account-number")).toHaveValue("123456789");
  await expect(page.getByRole("button", { name: "Lưu cài đặt" })).toBeEnabled();
  await page.unroute("**/admin/settings", failAction);
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  await expect(toast(page, "success")).toContainText("Lưu cài đặt thành công");
  await page.reload();
  await expect(page.locator("#store-name")).toHaveValue(`${prefix} cửa hàng`);
});

test("mobile: lưu cuối trang vẫn thấy toast và đóng được", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, "/admin/settings");
  await fillSettings(page);
  await page.getByRole("button", { name: "Lưu cài đặt" }).click();
  const notification = toast(page, "success");
  await expect(notification).toBeInViewport();
  await expect(notification).toContainText("Lưu cài đặt thành công");
  await test.info().attach("Toast lưu cài đặt trên mobile", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await notification.hover();
  await notification.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(notification).toHaveCount(0);
});

test("sản phẩm: lưu giá lẻ và tồn thập phân, đóng modal, tải lại vẫn đúng", async ({
  page,
}) => {
  await login(page, "/admin/products");
  const name = `${prefix} giá lẻ`;
  const dialog = await openCreate(page, name);
  await dialog.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(toast(page, "success")).toBeInViewport();
  await expect
    .poll(async () => {
      const saved = await prisma.product.findFirst({ where: { name } });
      return saved ? { price: saved.price, stock: saved.stock } : null;
    })
    .toEqual({ price: 7500, stock: 1.25 });
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("7.500");
  await expect(row).toContainText(/1[.,]25 cái/);
});

test("sản phẩm: lỗi mạng giữ bản nháp, thử lại chỉ tạo một sản phẩm", async ({
  page,
}) => {
  await login(page, "/admin/products");
  const name = `${prefix} thử lại`;
  const dialog = await openCreate(page, name);
  await page.route("**/admin/products", failAction);
  await dialog.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(toast(page, "error")).toContainText(
    "Không thể lưu sản phẩm. Vui lòng thử lại.",
  );
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tên sản phẩm")).toHaveValue(name);
  await expect(
    dialog.getByRole("spinbutton", { name: "Giá bán", exact: true }),
  ).toHaveValue("7500");
  expect(await prisma.product.count({ where: { name } })).toBe(0);
  await page.unroute("**/admin/products", failAction);
  await dialog.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(toast(page, "success")).toBeVisible();
  expect(await prisma.product.count({ where: { name } })).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("an-phat-product-draft")),
  ).toBeNull();
});

test("sản phẩm: tên chỉ có khoảng trắng bị từ chối rồi sửa và lưu được", async ({
  page,
}) => {
  await login(page, "/admin/products");
  const dialog = await openCreate(page, "   ");
  await dialog.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(toast(page, "error")).toContainText(
    "Tên sản phẩm không được để trống",
  );
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Tên sản phẩm").fill(`${prefix} sửa validation`);
  await dialog.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(toast(page, "success")).toBeVisible();
});

test("sửa nhanh: lưu giá lẻ và tồn âm, toast còn sau khi modal đóng", async ({
  page,
}) => {
  await login(page, "/admin/products");
  const name = `${prefix} sửa nhanh`;
  const create = await openCreate(page, name);
  await create.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(create).not.toBeVisible();
  await page
    .getByRole("button", { name: `Sửa nhanh giá và tồn kho của ${name}` })
    .click();
  const dialog = page.getByRole("dialog", { name: `Sửa nhanh ${name}` });
  await dialog
    .getByRole("spinbutton", { name: "Giá bán", exact: true })
    .fill("4500");
  await dialog
    .getByRole("spinbutton", { name: "Tồn kho cái", exact: true })
    .fill("-2.5");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(toast(page, "success")).toBeInViewport();
  await expect
    .poll(async () => {
      const saved = await prisma.product.findFirst({ where: { name } });
      return saved ? { price: saved.price, stock: saved.stock } : null;
    })
    .toEqual({ price: 4500, stock: -2.5 });
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: name })).toContainText(
    "4.500",
  );
});

test("sửa nhanh: lỗi mạng không đóng modal, thử lại lưu đúng một lần", async ({
  page,
}) => {
  await login(page, "/admin/products");
  const name = `${prefix} sửa nhanh thử lại`;
  const create = await openCreate(page, name);
  await create.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(create).not.toBeVisible();
  await page
    .getByRole("button", { name: `Sửa nhanh giá và tồn kho của ${name}` })
    .click();
  const dialog = page.getByRole("dialog", { name: `Sửa nhanh ${name}` });
  await dialog
    .getByRole("spinbutton", { name: "Giá bán", exact: true })
    .fill("9500");
  await page.route("**/admin/products", failAction);
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(toast(page, "error")).toContainText(
    "Không thể lưu sản phẩm. Vui lòng thử lại.",
  );
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("spinbutton", { name: "Giá bán", exact: true }),
  ).toHaveValue("9500");
  expect((await prisma.product.findFirst({ where: { name } }))?.price).toBe(
    7500,
  );
  await page.unroute("**/admin/products", failAction);
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  await expect
    .poll(
      async () => (await prisma.product.findFirst({ where: { name } }))?.price,
    )
    .toBe(9500);
});

test("sửa chi tiết: đổi tên và giá rồi tải lại vẫn thấy giá trị mới", async ({
  page,
}) => {
  await login(page, "/admin/products");
  const name = `${prefix} sửa chi tiết`;
  const create = await openCreate(page, name);
  await create.getByRole("button", { name: "Lưu và nhập món tiếp" }).click();
  await expect(create).not.toBeVisible();
  await page.getByRole("button", { name: `Sửa ${name}`, exact: true }).click();
  const dialog = page.getByRole("dialog", { name: `Sửa sản phẩm: ${name}` });
  await dialog.getByLabel("Tên sản phẩm").fill(`${name} mới`);
  await dialog
    .getByRole("spinbutton", { name: "Giá bán", exact: true })
    .fill("8500");
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(toast(page, "success")).toBeInViewport();
  await page.reload();
  const row = page.getByRole("row").filter({ hasText: `${name} mới` });
  await expect(row).toContainText("8.500");
  expect(
    await prisma.product.count({ where: { name: { startsWith: name } } }),
  ).toBe(1);
});

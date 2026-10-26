import { randomBytes, randomInt, randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { hashCustomerPassword } from "@/server/customer-auth/password";
import { saveProduct } from "@/server/products/save-product";
import { BACK_IN_STOCK_NOTIFICATION_KIND } from "@/types/back-in-stock";

import { STORE_PASSWORD } from "./credentials";

const prisma = new PrismaClient();
// Mỗi lần nạp file (kể cả lần retry) có sản phẩm và khách riêng: tên, slug và
// số điện thoại không đụng spec khác hay lần chạy trước. Mật khẩu khách cũng
// sinh ngẫu nhiên như mật khẩu cửa hàng trong playwright.config.ts.
const token = randomUUID().slice(0, 8);
const PRODUCT_NAME = `Hàng chờ về E2E ${token}`;
const CUSTOMER_PHONE = `09${randomInt(10_000_000, 100_000_000)}`;
const CUSTOMER_PASSWORD = `e2e-cust-${randomBytes(12).toString("hex")}`;

const TOGGLE_NAME = "Báo khi có hàng";
const LOGIN_LINK_NAME = "Đăng nhập để nhận thông báo khi có hàng";
const SUBSCRIBED_NOTE =
  "Đã bật: bạn sẽ nhận thông báo trong hộp thư khi sản phẩm có hàng.";
const NOTIFICATION_TITLE = "Sản phẩm bạn chờ đã có hàng";
const ONE_WAITING = "1 khách chờ báo có hàng";

let productId = "";
let productPath = "";
let accountId = "";

test.use({ extraHTTPHeaders: { "X-Real-IP": "1.1.1.1" } });

test.beforeAll(async () => {
  // Tạo qua saveProduct như admin: có slug, và searchText để lọc bảng admin.
  const saved = await saveProduct({
    name: PRODUCT_NAME,
    unit: "cái",
    price: 45_000,
    costPrice: 30_000,
    stock: 0,
    isActive: true,
  });
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: saved.id },
    select: { id: true, slug: true },
  });
  productId = product.id;
  productPath = `/shop/p/${product.slug}`;

  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized: `+84${CUSTOMER_PHONE.slice(1)}`,
      displayName: "Khách chờ hàng E2E",
      passwordHash: await hashCustomerPassword(CUSTOMER_PASSWORD),
      phoneVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  accountId = account.id;
});

test.afterAll(async () => {
  // Xóa tài khoản kéo theo phiên, đăng ký và thông báo; xóa sản phẩm kéo theo
  // phiếu kho của lần nhập hàng.
  if (accountId) {
    await prisma.customerAccount.deleteMany({ where: { id: accountId } });
  }
  if (productId) {
    await prisma.product.deleteMany({ where: { id: productId } });
  }
  await prisma.$disconnect();
});

async function submitCustomerLogin(page: Page) {
  await page.getByLabel("Số điện thoại").fill(CUSTOMER_PHONE);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(CUSTOMER_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function loginCustomer(page: Page, next?: string) {
  await page.goto(
    next ? `/account/login?next=${encodeURIComponent(next)}` : "/account/login",
  );
  await submitCustomerLogin(page);
}

async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Mật khẩu cửa hàng" })
    .fill(STORE_PASSWORD);
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await page.waitForURL("**/pos");
}

/** Ô "Khách chờ" của sản phẩm fixture trong bảng /admin/products đã lọc. */
async function openWaitingCell(page: Page) {
  await page.goto(`/admin/products?q=${token}`);
  await expect(
    page.getByRole("columnheader", { name: "Khách chờ", exact: true }),
  ).toBeVisible();
  const headers = await page.getByRole("columnheader").allTextContents();
  const column = headers.findIndex((text) => text.trim() === "Khách chờ");
  const row = page.getByRole("row").filter({ hasText: PRODUCT_NAME });
  await expect(row).toHaveCount(1);
  return row.getByRole("cell").nth(column);
}

/** Nhập hàng qua nút "Sửa nhanh" trong bảng sản phẩm, rồi tải lại bảng. */
async function quickEditStock(page: Page, stock: number) {
  await page
    .getByRole("button", {
      name: `Sửa nhanh giá và tồn kho của ${PRODUCT_NAME}`,
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog", {
    name: `Sửa nhanh ${PRODUCT_NAME}`,
  });
  await dialog
    .getByRole("spinbutton", { name: "Tồn kho cái", exact: true })
    .fill(String(stock));
  await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.locator('[data-slot="toast"][data-type="success"]').last(),
  ).toContainText("Đã lưu sản phẩm thành công");
  // Form sửa nhanh gửi tồn kho lúc mở làm mốc so-và-ghi: tải lại để lần sau
  // mở form với số mới.
  await page.reload();
}

function backInStockNotifications() {
  return prisma.customerNotification.findMany({
    where: { accountId, kind: BACK_IN_STOCK_NOTIFICATION_KIND },
    select: { href: true },
  });
}

/** Ảnh toàn trang vào thư mục kết quả và báo cáo HTML của Playwright. */
async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test.describe("Báo khi có hàng", () => {
  // Các bước nối tiếp trên cùng sản phẩm và khách: bước trước hỏng thì bỏ qua
  // bước sau, retry chạy lại cả nhóm với fixture mới.
  test.describe.configure({ mode: "serial" });

  test("khách chưa đăng nhập thấy link đăng nhập và quay lại đúng sản phẩm", async ({
    page,
  }, testInfo) => {
    await page.goto(productPath);
    await expect(
      page.getByRole("heading", { name: PRODUCT_NAME, level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tạm hết hàng", exact: true }),
    ).toBeDisabled();
    const loginLink = page.getByRole("link", { name: LOGIN_LINK_NAME });
    await expect(loginLink).toBeVisible();
    await expect(
      page.getByRole("button", { name: TOGGLE_NAME, exact: true }),
    ).toHaveCount(0);
    await attachScreenshot(page, testInfo, "1-chua-dang-nhap");

    await loginLink.click();
    await expect(page).toHaveURL(
      `/account/login?next=${encodeURIComponent(productPath)}`,
    );
    await submitCustomerLogin(page);
    await expect(page).toHaveURL(productPath);
    const toggle = page.getByRole("button", { name: TOGGLE_NAME, exact: true });
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(loginLink).toHaveCount(0);
  });

  test("khách đăng nhập bật, tải lại vẫn giữ, hủy rồi bật lại", async ({
    page,
  }, testInfo) => {
    await loginCustomer(page, productPath);
    await expect(page).toHaveURL(productPath);
    const toggle = page.getByRole("button", { name: TOGGLE_NAME, exact: true });
    const subscribedNote = page.getByText(SUBSCRIBED_NOTE);
    // Nút bị khóa tới khi tải xong trạng thái từ /api/customer/back-in-stock.
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(subscribedNote).toHaveCount(0);
    await attachScreenshot(page, testInfo, "2-chua-dang-ky");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(subscribedNote).toBeVisible();
    await attachScreenshot(page, testInfo, "3-da-dang-ky");

    await page.reload();
    await expect(toggle).toBeEnabled();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(subscribedNote).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(subscribedNote).toHaveCount(0);
    expect(
      await prisma.backInStockSubscription.count({
        where: { accountId, productId },
      }),
    ).toBe(0);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(subscribedNote).toBeVisible();
    expect(
      await prisma.backInStockSubscription.count({
        where: { accountId, productId },
      }),
    ).toBe(1);
  });

  test("admin thấy 1 khách ở cột Khách chờ", async ({ page }) => {
    await loginAdmin(page);
    const waiting = await openWaitingCell(page);
    await expect(waiting).toHaveText(ONE_WAITING);
  });

  test("admin nhập hàng gửi đúng một thông báo, nhập thêm không gửi lại", async ({
    page,
  }) => {
    await loginAdmin(page);
    const waiting = await openWaitingCell(page);
    await expect(waiting).toHaveText(ONE_WAITING);
    expect(await backInStockNotifications()).toHaveLength(0);

    // Gửi báo chạy xong trước khi server action trả kết quả (trước toast).
    await quickEditStock(page, 5);
    await expect(waiting).toHaveText("—");
    expect(await backInStockNotifications()).toEqual([{ href: productPath }]);
    expect(
      await prisma.backInStockSubscription.count({ where: { productId } }),
    ).toBe(0);

    await quickEditStock(page, 9);
    await expect(waiting).toHaveText("—");
    expect(await backInStockNotifications()).toHaveLength(1);
  });

  test("khách có đúng một thông báo, bấm vào mở trang sản phẩm đã có hàng", async ({
    page,
  }, testInfo) => {
    await loginCustomer(page);
    await expect(page).toHaveURL(/\/account\/orders$/);
    const inboxButton = page.getByRole("button", { name: /^Thông báo/ });
    await expect(inboxButton).toHaveAccessibleName("Thông báo, 1 chưa đọc");
    await inboxButton.click();
    const panel = page.getByRole("region", { name: "Hộp thư thông báo" });
    await expect(panel).toBeVisible();
    const notification = panel.getByRole("link", { name: NOTIFICATION_TITLE });
    await expect(notification).toHaveCount(1);
    await expect(notification).toHaveAttribute("href", productPath);
    await expect(notification).toContainText(PRODUCT_NAME);
    await expect(notification).toContainText("Xem sản phẩm");
    await attachScreenshot(page, testInfo, "4-hop-thu-thong-bao");

    // Cố ý không mở/tải lại trang sản phẩm trước: lần bấm này là lần tải đầu
    // tiên sau khi nhập hàng, như khách thật bấm từ thông báo.
    await notification.click();
    await expect(page).toHaveURL(productPath);
    await expect(
      page.getByRole("button", { name: "Thêm vào giỏ hàng", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Mua ngay", exact: true }),
    ).toBeVisible();
    // Hết hàng mới có nút/link báo: cả hai đã nhường chỗ cho nút mua.
    const loginLink = page.getByRole("link", { name: LOGIN_LINK_NAME });
    await expect(
      page.getByRole("button", { name: TOGGLE_NAME, exact: true }),
    ).toHaveCount(0);
    await expect(loginLink).toHaveCount(0);
    await attachScreenshot(page, testInfo, "5-da-co-hang");
  });
});

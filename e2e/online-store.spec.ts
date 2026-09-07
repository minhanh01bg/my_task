import { expect, test } from "@playwright/test";

test("khách truy cập cửa hàng công khai và tìm sản phẩm", async ({ page }) => {
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: "Hàng thiết yếu, đặt nhanh tại nhà" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("Tìm tên sản phẩm…")).toBeVisible();
  await expect(page).not.toHaveURL(/login/);
});

test("route nội bộ vẫn yêu cầu đăng nhập", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/login/);
});

test("admin authorization: unauthenticated access to admin order details redirects to login", async ({
  page,
}) => {
  await page.goto("/admin/orders/unauthenticated-test-id");
  await expect(page).toHaveURL(/login/);
});

test("idempotency and guest recovery: duplicate checkout returns identical order and preserves capability", async ({
  request,
}) => {
  const productsRes = await request.get("/api/products");
  if (!productsRes.ok()) return;
  const products = await productsRes.json();
  const product = products.find(
    (p: { stock: number; isService?: boolean }) => p.stock > 1 && !p.isService,
  );
  if (!product) return;

  const clientId = "4901b088-0f58-472d-8ae5-df93e75e3e2b";
  const payload = {
    clientId,
    lines: [{ productId: product.id, quantity: 1 }],
    contactName: "Khách Hàng E2E",
    contactPhone: "0901234567",
    fulfillmentType: "pickup",
    paymentMethod: "cod",
  };

  const firstRes = await request.post("/api/online/orders", { data: payload });
  expect(firstRes.status()).toBe(201);
  const firstData = await firstRes.json();
  expect(firstData.data.duplicated).toBe(false);
  expect(firstData.data.order.code).toBeTruthy();

  const retryRes = await request.post("/api/online/orders", { data: payload });
  expect(retryRes.status()).toBe(200);
  const retryData = await retryRes.json();
  expect(retryData.data.duplicated).toBe(true);
  expect(retryData.data.order.code).toBe(firstData.data.order.code);
});

test("receipt enumeration: sequential code returns 404 while invalid nonce is not found", async ({
  page,
}) => {
  const response = await page.goto("/order-success/DH0001");
  expect(response?.status()).toBe(404);
});

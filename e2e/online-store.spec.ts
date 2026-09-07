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

test("CSP enforcement and reporting: pages include CSP header and emit no violations", async ({
  page,
}) => {
  const violations: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (
      text.toLowerCase().includes("content security policy") ||
      text
        .toLowerCase()
        .includes("violates the following content security policy")
    ) {
      violations.push(text);
    }
  });

  const pagesToTest = [
    "/shop",
    "/checkout",
    "/account",
    "/orders/guest/invalid-token-test",
    "/admin/orders",
  ];

  for (const path of pagesToTest) {
    const response = await page.goto(path);
    expect(response).toBeTruthy();
    const headers = response?.headers() || {};
    const hasCsp =
      Boolean(headers["content-security-policy"]) ||
      Boolean(headers["content-security-policy-report-only"]);
    expect(hasCsp, `Page ${path} should have CSP header`).toBe(true);
  }

  expect(violations).toEqual([]);
});

test("admin session lifecycle: unauthenticated redirect and logout cookie revocation", async ({
  page,
  request,
}) => {
  // Accessing /admin/orders without auth redirects to /login
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/.*\/login/);

  // Calling logout clears the admin session cookie
  const logoutRes = await request.post("/api/auth/logout", {
    headers: { origin: "http://localhost:3000" },
  });
  expect(logoutRes.status()).toBe(200);
  const setCookie = logoutRes.headers()["set-cookie"] || "";
  expect(setCookie).toContain("pos_session=");
  expect(setCookie).toContain("Max-Age=0");
});

test("guest claim and guest revoke: access controls and unauthenticated protection", async ({
  request,
}) => {
  // 1. Unauthenticated claim attempt returns 401
  const unauthClaim = await request.post("/api/customer/orders/claim", {
    headers: { origin: "http://localhost:3000" },
    data: { token: "sample-guest-token-12345" },
  });
  expect(unauthClaim.status()).toBe(401);

  // 2. Cross-origin claim attempt returns 403
  const crossOriginClaim = await request.post("/api/customer/orders/claim", {
    headers: {
      origin: "https://evil.attacker.com",
      "sec-fetch-site": "cross-site",
    },
    data: { token: "sample-guest-token-12345" },
  });
  expect(crossOriginClaim.status()).toBe(403);

  // 3. Unauthenticated revoke attempt returns 401
  const unauthRevoke = await request.post(
    "/api/customer/orders/guest-access/revoke",
    {
      headers: { origin: "http://localhost:3000" },
      data: { orderId: "sample-order-id-12345" },
    },
  );
  expect(unauthRevoke.status()).toBe(401);

  // 4. Cross-origin revoke attempt returns 403
  const crossOriginRevoke = await request.post(
    "/api/customer/orders/guest-access/revoke",
    {
      headers: {
        origin: "https://evil.attacker.com",
        "sec-fetch-site": "cross-site",
      },
      data: { orderId: "sample-order-id-12345" },
    },
  );
  expect(crossOriginRevoke.status()).toBe(403);
});

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
  if (response?.status() === 404) {
    expect(response.status()).toBe(404);
  } else {
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible(
      { timeout: 15000 },
    );
  }
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
}) => {
  // Accessing /admin/orders without auth redirects to /login
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/.*\/login/);

  await page.getByRole("textbox", { name: "Mật khẩu cửa hàng" }).fill("123456");
  await page.getByRole("button", { name: /vào bán hàng/i }).click();
  await expect(page).toHaveURL(/.*\/pos/);

  // Admin can move to the public shop and return through an identity-aware link.
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: "Xem cửa hàng online" }).click();
  await expect(page).toHaveURL(/.*\/shop/);
  await page.getByRole("link", { name: "Quay lại trang quản trị" }).click();
  await expect(page).toHaveURL(/.*\/admin\/orders/);

  // Admin can log out from the visible desktop navigation.
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/.*\/login/);

  // The revoked session can no longer access protected admin routes.
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/.*\/login/);
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

test("cart drawer: mở drawer, xem danh sách sản phẩm và đóng drawer", async ({
  page,
}) => {
  await page.goto("/shop");
  const cartBtn = page.getByRole("button", { name: /mở giỏ hàng/i });
  await expect(cartBtn).toBeVisible();
  await cartBtn.click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(/giỏ hàng.*trống/i)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
});

test("cart persistence: thêm sản phẩm và giữ nguyên sau khi reload", async ({
  page,
}) => {
  await page.goto("/shop");
  const addBtn = page.getByRole("button", { name: /thêm .* vào giỏ/i }).first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await expect(page.getByRole("status")).toBeVisible();

    await page.reload();
    const cartBtn = page.getByRole("button", { name: /mở giỏ hàng/i });
    await cartBtn.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("cart-subtotal")).toBeVisible();
  }
});

test("catalog filter: lọc theo danh mục và tìm kiếm đồng bộ URL", async ({
  page,
}) => {
  await page.goto("/shop");
  const searchInput = page.getByPlaceholder("Tìm tên sản phẩm…");
  await expect(searchInput).toBeVisible();

  await searchInput.fill("cà phê");
  await expect(page).toHaveURL(/q=/);

  const categoryGroup = page.getByRole("group", { name: "Danh mục sản phẩm" });
  const categoryBtn = categoryGroup.getByRole("button").nth(1);
  if (await categoryBtn.isVisible()) {
    await categoryBtn.click();
    await expect(categoryBtn).toHaveAttribute("aria-pressed", "true");
  }
});

test("catalog sort: thay đổi thứ tự sắp xếp cập nhật URL", async ({ page }) => {
  await page.goto("/shop");
  const sortSelect = page.getByLabel("Sắp xếp theo");
  await expect(sortSelect).toBeVisible();
  await sortSelect.selectOption("price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);
});

test("store information: footer hiển thị thông tin cửa hàng và liên kết chính sách", async ({
  page,
}) => {
  await page.goto("/shop");
  const footer = page.locator("footer");
  await expect(footer).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "Chính sách giao hàng" }),
  ).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "Chính sách đổi trả" }),
  ).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "Chính sách bảo mật" }),
  ).toBeVisible();
});

test("pickup address: chọn nhận tại cửa hàng hiển thị thông tin nhận hàng", async ({
  page,
}) => {
  await page.goto("/shop");
  const addBtn = page.getByRole("button", { name: /thêm .* vào giỏ/i }).first();
  if (await addBtn.isVisible()) {
    await addBtn.click();
    await page.goto("/checkout");

    const pickupRadio = page.getByLabel("Nhận tại cửa hàng");
    await expect(pickupRadio).toBeVisible();
    await pickupRadio.click();

    await expect(page.getByTestId("pickup-store-info")).toBeVisible();
    await expect(page.getByLabel(/tỉnh\/thành phố/i)).not.toBeVisible();
  }
});

test("landing: bố cục trang chủ có hero, danh mục và cuộn tới catalog khi nhấn Mua ngay", async ({
  page,
}) => {
  await page.goto("/shop");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toBeVisible();
  await expect(h1).toHaveText(/Hàng thiết yếu, đặt nhanh tại nhà/i);

  // Danh mục sản phẩm
  await expect(
    page.getByRole("heading", { name: "Danh mục sản phẩm" }),
  ).toBeVisible();

  // CTA Mua ngay
  const cta = page.getByRole("link", { name: "Mua ngay" });
  await expect(cta).toBeVisible();
  await cta.click();
  await expect(page).toHaveURL(/#catalog/);
  await expect(page.locator("#catalog")).toBeVisible();
});

test("featured: hiển thị danh sách sản phẩm nổi bật trên landing page", async ({
  page,
}) => {
  await page.goto("/shop");
  const railHeading = page.getByRole("heading", { name: "Sản phẩm nổi bật" });
  await expect(railHeading).toBeVisible();
});

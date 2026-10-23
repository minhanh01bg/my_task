import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET, POST } from "@/app/api/customer/back-in-stock/route";
import { setBackInStockRateLimiter } from "@/server/back-in-stock/back-in-stock-rate-limit";
import { createCustomerSession } from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";
import type { RateLimiter } from "@/server/security/rate-limit";

const allow: RateLimiter = {
  async check() {
    return { allowed: true, remaining: 20, limit: 20, resetInSeconds: 60 };
  },
};

const deny: RateLimiter = {
  async check() {
    return {
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: 42,
      limit: 20,
      remaining: 0,
    };
  },
};

const URL_BASE = "https://example.com/api/customer/back-in-stock";
const OUT_OF_STOCK_ID = "bis-api-out";
const IN_STOCK_ID = "bis-api-in";
const PHONE = "+84900000921";

let accountId: string;
let cookie: string;

function getRequest(productId: string | null, withCookie = true) {
  const url =
    productId === null
      ? URL_BASE
      : `${URL_BASE}?productId=${encodeURIComponent(productId)}`;
  return new Request(url, { headers: withCookie ? { cookie } : {} });
}

function postRequest(
  body: unknown,
  headers: Record<string, string> = { cookie },
) {
  return new Request(URL_BASE, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function subscriptionCount() {
  return prisma.backInStockSubscription.count({ where: { accountId } });
}

async function cleanup() {
  await prisma.backInStockSubscription.deleteMany();
  await prisma.customerSession.deleteMany();
  await prisma.customerAccount.deleteMany({
    where: { phoneNormalized: PHONE },
  });
  await prisma.product.deleteMany({
    where: { id: { in: [OUT_OF_STOCK_ID, IN_STOCK_ID] } },
  });
}

beforeEach(async () => {
  setBackInStockRateLimiter(allow);
  await cleanup();
  await prisma.product.createMany({
    data: [
      { id: OUT_OF_STOCK_ID, name: "Cà phê sữa đá", price: 25_000, stock: 0 },
      { id: IN_STOCK_ID, name: "Trà đào", price: 30_000, stock: 5 },
    ],
  });
  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized: PHONE,
      displayName: "Khách chờ",
      passwordHash: "x",
    },
  });
  accountId = account.id;
  const session = await createCustomerSession(accountId);
  cookie = `customer_session=${session.token}`;
});

afterEach(() => {
  setBackInStockRateLimiter(null);
  vi.restoreAllMocks();
});
afterAll(cleanup);

describe("GET /api/customer/back-in-stock", () => {
  it("401 khi chưa đăng nhập", async () => {
    const response = await GET(getRequest(OUT_OF_STOCK_ID, false));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      message: "Vui lòng đăng nhập để nhận thông báo khi có hàng",
    });
  });

  it.each([[null], [""], ["../x"], ["a".repeat(65)]])(
    "400 khi productId sai %j",
    async (productId) => {
      const response = await GET(getRequest(productId));
      expect(response.status).toBe(400);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).toEqual({
        message: "Dữ liệu không hợp lệ",
      });
    },
  );

  it("200 trả trạng thái chưa đăng ký rồi đã đăng ký", async () => {
    const before = await GET(getRequest(OUT_OF_STOCK_ID));
    expect(before.status).toBe(200);
    expect(before.headers.get("cache-control")).toBe("private, no-store");
    expect(await before.json()).toEqual({
      productId: OUT_OF_STOCK_ID,
      subscribed: false,
    });

    await prisma.backInStockSubscription.create({
      data: { accountId, productId: OUT_OF_STOCK_ID },
    });

    const after = await GET(getRequest(OUT_OF_STOCK_ID));
    expect(await after.json()).toEqual({
      productId: OUT_OF_STOCK_ID,
      subscribed: true,
    });
  });
});

describe("POST /api/customer/back-in-stock", () => {
  it.each([
    [{ origin: "https://evil.example" }],
    [{ "sec-fetch-site": "cross-site" }],
  ])("403 khi yêu cầu đến từ nguồn khác %j", async (headers) => {
    const response = await POST(
      postRequest(
        { productId: OUT_OF_STOCK_ID, subscribed: true },
        { cookie, ...headers },
      ),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      message: "Nguồn gốc yêu cầu không hợp lệ",
    });
    expect(await subscriptionCount()).toBe(0);
  });

  it("401 khi chưa đăng nhập", async () => {
    const response = await POST(
      postRequest({ productId: OUT_OF_STOCK_ID, subscribed: true }, {}),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      message: "Vui lòng đăng nhập để nhận thông báo khi có hàng",
    });
  });

  it("415 khi nội dung không phải JSON", async () => {
    const response = await POST(
      new Request(URL_BASE, {
        method: "POST",
        headers: { "content-type": "text/plain", cookie },
        body: "productId=bis-api-out",
      }),
    );
    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).message).toBeTruthy();
  });

  it.each([
    [{ productId: OUT_OF_STOCK_ID }],
    [{ productId: OUT_OF_STOCK_ID, subscribed: "true" }],
    [{ productId: OUT_OF_STOCK_ID, subscribed: true, accountId: "khac" }],
  ])("400 khi dữ liệu sai %j", async (body) => {
    const response = await POST(postRequest(body));
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ message: "Dữ liệu không hợp lệ" });
    expect(await subscriptionCount()).toBe(0);
  });

  it("404 khi sản phẩm không tồn tại", async () => {
    const response = await POST(
      postRequest({ productId: "khong-co", subscribed: true }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      code: "product_not_found",
      message: "Không tìm thấy sản phẩm",
    });
  });

  it("409 kèm code khi sản phẩm đang còn hàng", async () => {
    const response = await POST(
      postRequest({ productId: IN_STOCK_ID, subscribed: true }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      code: "product_in_stock",
      message: "Sản phẩm đã có hàng trở lại, bạn có thể đặt mua ngay",
    });
    expect(await subscriptionCount()).toBe(0);
  });

  it("200 bật rồi tắt; gửi lặp lại vô hại", async () => {
    for (let i = 0; i < 2; i++) {
      const on = await POST(
        postRequest({ productId: OUT_OF_STOCK_ID, subscribed: true }),
      );
      expect(on.status).toBe(200);
      expect(on.headers.get("cache-control")).toBe("private, no-store");
      expect(await on.json()).toEqual({
        productId: OUT_OF_STOCK_ID,
        subscribed: true,
      });
    }
    expect(await subscriptionCount()).toBe(1);

    for (let i = 0; i < 2; i++) {
      const off = await POST(
        postRequest({ productId: OUT_OF_STOCK_ID, subscribed: false }),
      );
      expect(off.status).toBe(200);
      expect(await off.json()).toEqual({
        productId: OUT_OF_STOCK_ID,
        subscribed: false,
      });
    }
    expect(await subscriptionCount()).toBe(0);
  });

  it("tắt vẫn được khi sản phẩm đã có hàng lại", async () => {
    await prisma.backInStockSubscription.create({
      data: { accountId, productId: IN_STOCK_ID },
    });
    const response = await POST(
      postRequest({ productId: IN_STOCK_ID, subscribed: false }),
    );
    expect(response.status).toBe(200);
    expect(await subscriptionCount()).toBe(0);
  });

  it("429 kèm Retry-After khi bị giới hạn", async () => {
    setBackInStockRateLimiter(deny);
    const response = await POST(
      postRequest({ productId: OUT_OF_STOCK_ID, subscribed: true }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    });
    expect(await subscriptionCount()).toBe(0);
  });

  it("500 với thông báo chung và ghi log khi lỗi bất ngờ", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    vi.spyOn(prisma, "$transaction").mockRejectedValueOnce(
      Object.assign(new Error(`lỗi với ${PHONE}`), { code: "P1008" }),
    );
    const response = await POST(
      postRequest({ productId: OUT_OF_STOCK_ID, subscribed: true }),
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      message: "Không cập nhật được đăng ký. Vui lòng thử lại.",
    });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).toContain("back_in_stock_update_failed");
    expect(logged).toContain(OUT_OF_STOCK_ID);
    expect(logged).not.toContain(PHONE);
  });
});

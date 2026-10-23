import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("@/server/orders/create-order", () => ({ createOrder: vi.fn() }));

import { GET as getCatalog } from "@/app/api/catalog/route";
import {
  GET as listCustomers,
  POST as createCustomer,
} from "@/app/api/customers/route";
import { POST as createPosOrder } from "@/app/api/orders/route";
import {
  createAdminSession,
  revokeAdminSession,
  SESSION_COOKIE,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { createOrder } from "@/server/orders/create-order";
import { OrderValidationError } from "@/server/orders/order-validation-error";

const ORIGIN = "http://localhost";
const FAKE_COOKIE = `${SESSION_COOKIE}=x`;
const CUSTOMER_PREFIX = "Khách kiểm thử phiên POS";

const mockedCreateOrder = vi.mocked(createOrder);
let adminToken = "";

function adminCookie(): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(adminToken)}`;
}

function orderPayload(clientId = "pos-auth-1") {
  return {
    clientId,
    channel: "pos",
    lines: [
      {
        productId: null,
        name: "Công lắp đặt",
        unitPrice: 50000,
        originalPrice: 50000,
        quantity: 1,
        discount: 0,
        unit: "lần",
        isService: true,
      },
    ],
    orderDiscount: 0,
    payments: [{ method: "cash", amount: 50000 }],
  };
}

function jsonHeaders(cookie?: string, origin = ORIGIN): HeadersInit {
  return {
    "content-type": "application/json",
    origin,
    ...(cookie ? { cookie } : {}),
  };
}

const ENDPOINTS: Array<[string, (cookie?: string) => Promise<Response>]> = [
  [
    "GET /api/catalog",
    (cookie) =>
      getCatalog(
        new Request(`${ORIGIN}/api/catalog`, {
          headers: cookie ? { cookie } : undefined,
        }),
      ),
  ],
  [
    "GET /api/customers",
    (cookie) =>
      listCustomers(
        new Request(`${ORIGIN}/api/customers?q=a`, {
          headers: cookie ? { cookie } : undefined,
        }),
      ),
  ],
  [
    "POST /api/customers",
    (cookie) =>
      createCustomer(
        new Request(`${ORIGIN}/api/customers`, {
          method: "POST",
          headers: jsonHeaders(cookie),
          body: JSON.stringify({ name: `${CUSTOMER_PREFIX} ẩn danh` }),
        }),
      ),
  ],
  [
    "POST /api/orders",
    (cookie) =>
      createPosOrder(
        new Request(`${ORIGIN}/api/orders`, {
          method: "POST",
          headers: jsonHeaders(cookie),
          body: JSON.stringify(orderPayload()),
        }),
      ),
  ],
];

async function countTestCustomers(): Promise<number> {
  return prisma.customer.count({
    where: { name: { startsWith: CUSTOMER_PREFIX } },
  });
}

beforeAll(async () => {
  adminToken = (await createAdminSession()).token;
});

beforeEach(async () => {
  vi.clearAllMocks();
  await prisma.customer.deleteMany({
    where: { name: { startsWith: CUSTOMER_PREFIX } },
  });
});

afterAll(async () => {
  await prisma.customer.deleteMany({
    where: { name: { startsWith: CUSTOMER_PREFIX } },
  });
  await revokeAdminSession(adminToken);
});

describe("POS API yêu cầu phiên quản trị đã xác minh", () => {
  it.each(ENDPOINTS)("%s không có cookie trả 401", async (_, call) => {
    const response = await call();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Chưa đăng nhập" });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
    expect(await countTestCustomers()).toBe(0);
  });

  it.each(ENDPOINTS)(
    "%s với cookie pos_session giả trả 401",
    async (_, call) => {
      const response = await call(FAKE_COOKIE);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ message: "Chưa đăng nhập" });
      expect(mockedCreateOrder).not.toHaveBeenCalled();
      expect(await countTestCustomers()).toBe(0);
    },
  );

  it("phiên thật tải được catalog POS", async () => {
    const response = await getCatalog(
      new Request(`${ORIGIN}/api/catalog`, {
        headers: { cookie: adminCookie() },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { products: unknown[] };
    expect(Array.isArray(body.products)).toBe(true);
  });

  it("phiên thật tạo rồi tra cứu được khách", async () => {
    const created = await createCustomer(
      new Request(`${ORIGIN}/api/customers`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify({
          name: `  ${CUSTOMER_PREFIX} Lan `,
          phone: "0900 000.000",
        }),
      }),
    );
    expect(created.status).toBe(201);

    const listed = await listCustomers(
      new Request(
        `${ORIGIN}/api/customers?q=${encodeURIComponent(CUSTOMER_PREFIX)}`,
        { headers: { cookie: adminCookie() } },
      ),
    );
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as {
      customers: Array<{ name: string; phone: string | null }>;
    };
    expect(body.customers).toEqual([
      expect.objectContaining({
        name: `${CUSTOMER_PREFIX} Lan`,
        phone: "0900000000",
      }),
    ]);
  });

  it("phiên thật tạo được đơn POS", async () => {
    mockedCreateOrder.mockResolvedValue({
      order: {
        id: "o1",
        code: "DH0001",
        subtotal: 50000,
        discount: 0,
        total: 50000,
        status: "paid",
        hasStockWarning: false,
      },
      duplicated: false,
    });

    const response = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify(orderPayload("pos-auth-ok")),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "pos-auth-ok", channel: "pos" }),
    );
  });

  it("BL-6: route POS luôn ghi kênh pos, kể cả khi client bỏ trống", async () => {
    mockedCreateOrder.mockResolvedValue({
      order: {
        id: "o-bl6",
        code: "DH0003",
        subtotal: 50000,
        discount: 0,
        total: 50000,
        status: "paid",
        hasStockWarning: false,
      },
      duplicated: false,
    });
    const withoutChannel: Partial<ReturnType<typeof orderPayload>> =
      orderPayload("pos-bl6-channel");
    delete withoutChannel.channel;

    const response = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify(withoutChannel),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "pos-bl6-channel", channel: "pos" }),
    );
  });

  it("BL-6: receivedAt quá 5 phút tương lai bị kẹp về giờ server, quá khứ giữ nguyên", async () => {
    mockedCreateOrder.mockResolvedValue({
      order: {
        id: "o-bl6-time",
        code: "DH0004",
        subtotal: 50000,
        discount: 0,
        total: 50000,
        status: "paid",
        hasStockWarning: false,
      },
      duplicated: false,
    });
    const past = new Date(Date.now() - 3 * 24 * 60 * 60_000);
    const slightSkew = new Date(Date.now() + 2 * 60_000);
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60_000);
    const payload = {
      ...orderPayload("pos-bl6-time"),
      payments: [past, slightSkew, farFuture].map((receivedAt) => ({
        method: "transfer",
        amount: 50000,
        receivedAt: receivedAt.toISOString(),
      })),
    };

    const before = Date.now();
    const response = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify(payload),
      }),
    );
    const after = Date.now();

    expect(response.status).toBe(201);
    const received = mockedCreateOrder.mock.calls[0]![0].payments.map((item) =>
      item.receivedAt?.getTime(),
    );
    expect(received[0]).toBe(past.getTime());
    expect(received[1]).toBe(slightSkew.getTime());
    expect(received[2]).toBeGreaterThanOrEqual(before);
    expect(received[2]).toBeLessThanOrEqual(after);
  });

  it("đơn POS trên 1 tỷ (tới trần cột Int) vẫn được nhận", async () => {
    mockedCreateOrder.mockResolvedValue({
      order: {
        id: "o2",
        code: "DH0002",
        subtotal: 2_147_483_647,
        discount: 0,
        total: 2_147_483_647,
        status: "paid",
        hasStockWarning: false,
      },
      duplicated: false,
    });
    const big = orderPayload("pos-auth-big");
    big.lines[0] = {
      ...big.lines[0]!,
      unitPrice: 2_147_483_647,
      originalPrice: 2_147_483_647,
    };
    big.payments = [{ method: "transfer", amount: 2_147_483_647 }];

    const response = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify(big),
      }),
    );

    expect(response.status).toBe(201);
    expect(mockedCreateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "pos-auth-big" }),
    );
  });

  it("thanh toán không khớp tổng đơn trả 422 kèm thông báo tiếng Việt", async () => {
    mockedCreateOrder.mockRejectedValueOnce(
      new OrderValidationError(
        "PAYMENT_SHORT",
        "Số tiền thanh toán chưa đủ tổng đơn",
      ),
    );

    const response = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify(orderPayload("pos-auth-short")),
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: "PAYMENT_SHORT",
      message: "Số tiền thanh toán chưa đủ tổng đơn",
    });
  });

  it("lỗi không phải nghiệp vụ vẫn được ném tiếp", async () => {
    mockedCreateOrder.mockRejectedValueOnce(new Error("db down"));

    await expect(
      createPosOrder(
        new Request(`${ORIGIN}/api/orders`, {
          method: "POST",
          headers: jsonHeaders(adminCookie()),
          body: JSON.stringify(orderPayload("pos-auth-crash")),
        }),
      ),
    ).rejects.toThrow("db down");
  });

  it("POST từ Origin lạ bị 403 dù có phiên thật", async () => {
    const order = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie(), "https://evil.example"),
        body: JSON.stringify(orderPayload()),
      }),
    );
    const customer = await createCustomer(
      new Request(`${ORIGIN}/api/customers`, {
        method: "POST",
        headers: jsonHeaders(adminCookie(), "https://evil.example"),
        body: JSON.stringify({ name: `${CUSTOMER_PREFIX} giả mạo` }),
      }),
    );

    expect(order.status).toBe(403);
    expect(customer.status).toBe(403);
    expect(mockedCreateOrder).not.toHaveBeenCalled();
    expect(await countTestCustomers()).toBe(0);
  });

  const line = orderPayload().lines[0]!;
  const payment = orderPayload().payments[0]!;
  const withLine = (overrides: Record<string, unknown>) =>
    JSON.stringify({ ...orderPayload(), lines: [{ ...line, ...overrides }] });

  it.each([
    ["giỏ rỗng", JSON.stringify({ ...orderPayload(), lines: [] })],
    ["có trường lạ", JSON.stringify({ ...orderPayload(), total: 1 })],
    [
      "giả kênh online",
      JSON.stringify({ ...orderPayload(), channel: "online" }),
    ],
    ["dòng hàng có trường lạ", withLine({ costPrice: 1 })],
    [
      "thanh toán có trường lạ",
      JSON.stringify({
        ...orderPayload(),
        payments: [{ ...payment, change: 1 }],
      }),
    ],
    [
      "quá 200 dòng",
      JSON.stringify({
        ...orderPayload(),
        lines: Array.from({ length: 201 }, () => line),
      }),
    ],
    [
      "quá 10 khoản thanh toán",
      JSON.stringify({
        ...orderPayload(),
        payments: Array.from({ length: 11 }, () => payment),
      }),
    ],
    [
      "số lượng vô hạn",
      JSON.stringify(orderPayload()).replace(
        '"quantity":1,',
        '"quantity":1e999,',
      ),
    ],
    ["số lượng quá 100000", withLine({ quantity: 100_001 })],
    ["đơn giá vượt cột Int", withLine({ unitPrice: 2_147_483_648 })],
    ["giá gốc vượt cột Int", withLine({ originalPrice: 2_147_483_648 })],
    ["giảm giá dòng vượt cột Int", withLine({ discount: 2_147_483_648 })],
    [
      "giảm giá đơn vượt cột Int",
      JSON.stringify({ ...orderPayload(), orderDiscount: 2_147_483_648 }),
    ],
    [
      "tiền thanh toán vượt cột Int",
      JSON.stringify({
        ...orderPayload(),
        payments: [{ ...payment, amount: 2_147_483_648 }],
      }),
    ],
    ["tên hàng quá dài", withLine({ name: "x".repeat(301) })],
    ["đơn vị quá dài", withLine({ unit: "x".repeat(51) })],
    [
      "clientId quá dài",
      JSON.stringify({ ...orderPayload(), clientId: "c".repeat(101) }),
    ],
    [
      "ghi chú quá dài",
      JSON.stringify({ ...orderPayload(), note: "x".repeat(1001) }),
    ],
  ])("đơn %s trả 400 mà không lộ chi tiết Zod", async (_, body) => {
    const response = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Dữ liệu đơn hàng không hợp lệ",
    });
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });

  it.each([
    ["thiếu body", null, "Thiếu tên khách"],
    ["tên chỉ có khoảng trắng", { name: "   " }, "Thiếu tên khách"],
    [
      "tên quá 100 ký tự",
      { name: `${CUSTOMER_PREFIX} ${"x".repeat(100)}` },
      "Tên khách tối đa 100 ký tự",
    ],
    [
      "SĐT sai định dạng",
      { name: `${CUSTOMER_PREFIX} Hùng`, phone: "12345" },
      "Số điện thoại không hợp lệ",
    ],
  ])("tạo khách %s trả 400", async (_, payload, message) => {
    const response = await createCustomer(
      new Request(`${ORIGIN}/api/customers`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message });
    expect(await countTestCustomers()).toBe(0);
  });

  it("tra cứu khách với từ khoá quá 100 ký tự trả 400", async () => {
    const response = await listCustomers(
      new Request(`${ORIGIN}/api/customers?q=${"a".repeat(101)}`, {
        headers: { cookie: adminCookie() },
      }),
    );

    expect(response.status).toBe(400);
  });

  it("đơn vượt giới hạn byte trả 413 trước khi xử lý", async () => {
    const response = await createPosOrder(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: jsonHeaders(adminCookie()),
        body: JSON.stringify({ ...orderPayload(), note: "x".repeat(300_000) }),
      }),
    );

    expect(response.status).toBe(413);
    expect(mockedCreateOrder).not.toHaveBeenCalled();
  });
});

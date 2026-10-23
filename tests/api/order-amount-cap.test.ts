import { randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { POST as createOnlineOrderRoute } from "@/app/api/online/orders/route";
import { POST as createPosOrderRoute } from "@/app/api/orders/route";
import {
  createAdminSession,
  revokeAdminSession,
  SESSION_COOKIE,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { setCheckoutAbuseLimiter } from "@/server/security/checkout-abuse";
import type { RateLimiter } from "@/server/security/rate-limit";

const ORIGIN = "http://localhost";
const PRODUCT_ID = "amount-cap-product";
/** Moi dong duoi tran cot Int (2.147.483.647) nhung 3 cai thi vuot. */
const UNIT_PRICE = 1_000_000_000;
const QUANTITY = 3;

const passLimiter: RateLimiter = {
  async check() {
    return {
      allowed: true as const,
      remaining: 10,
      limit: 10,
      resetInSeconds: 60,
    };
  },
};

let adminToken = "";

async function expectNothingWritten(clientId: string) {
  expect(await prisma.order.count({ where: { clientId } })).toBe(0);
  expect(await prisma.checkoutIdempotency.count({ where: { clientId } })).toBe(
    0,
  );
  expect(
    await prisma.stockMovement.count({ where: { productId: PRODUCT_ID } }),
  ).toBe(0);
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: PRODUCT_ID },
  });
  expect(product).toMatchObject({ stock: 10, soldCount: 0 });
}

beforeAll(async () => {
  adminToken = (await createAdminSession()).token;
});

beforeEach(async () => {
  setCheckoutAbuseLimiter(passLimiter);
  await prisma.stockMovement.deleteMany({ where: { productId: PRODUCT_ID } });
  await prisma.product.upsert({
    where: { id: PRODUCT_ID },
    create: {
      id: PRODUCT_ID,
      name: "Máy phát điện kiểm thử trần tiền",
      price: UNIT_PRICE,
      stock: 10,
    },
    update: { price: UNIT_PRICE, stock: 10, soldCount: 0, deletedAt: null },
  });
});

afterEach(() => {
  setCheckoutAbuseLimiter(null);
});

afterAll(async () => {
  await prisma.product.deleteMany({ where: { id: PRODUCT_ID } });
  await revokeAdminSession(adminToken);
});

describe("đơn có thành tiền vượt cột Int bị từ chối 4xx, không ghi gì", () => {
  it("POS: đơn giá × số lượng vượt trần trả 422 AMOUNT_TOO_LARGE", async () => {
    const clientId = randomUUID();

    const response = await createPosOrderRoute(
      new Request(`${ORIGIN}/api/orders`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: ORIGIN,
          cookie: `${SESSION_COOKIE}=${encodeURIComponent(adminToken)}`,
        },
        body: JSON.stringify({
          clientId,
          channel: "pos",
          lines: [
            {
              productId: PRODUCT_ID,
              name: "Máy phát điện",
              unitPrice: UNIT_PRICE,
              originalPrice: UNIT_PRICE,
              quantity: QUANTITY,
              discount: 0,
              unit: "cái",
              isService: false,
            },
          ],
          // Tra du tong de loi chi co the den tu tran cot Int.
          payments: [
            { method: "transfer", amount: 2_000_000_000 },
            { method: "transfer", amount: 1_000_000_000 },
          ],
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      code: "AMOUNT_TOO_LARGE",
      message: expect.stringContaining("tách thành nhiều đơn"),
    });
    await expectNothingWritten(clientId);
  });

  it("online: giá database × số lượng vượt trần trả 409 AMOUNT_TOO_LARGE", async () => {
    const clientId = randomUUID();

    const response = await createOnlineOrderRoute(
      new Request(`${ORIGIN}/api/online/orders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientId,
          lines: [{ productId: PRODUCT_ID, quantity: QUANTITY }],
          contactName: "Khách Kiểm Thử",
          contactPhone: "0901234567",
          fulfillmentType: "pickup",
          paymentMethod: "cod",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: "AMOUNT_TOO_LARGE",
      message: expect.stringContaining("tách thành nhiều đơn"),
    });
    await expectNothingWritten(clientId);
  });
});

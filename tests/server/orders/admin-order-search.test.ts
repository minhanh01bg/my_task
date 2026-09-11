import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildOrdersWhere } from "@/app/admin/orders/page";
import { prisma } from "@/server/db/prisma";

const testOnlineOrderId = "test-order-search-online";
const testPosOrderId = "test-order-search-pos";
const testCustomerId = "test-cust-search-pos";

beforeEach(async () => {
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: [testOnlineOrderId, testPosOrderId] } },
  });
  await prisma.order.deleteMany({
    where: { id: { in: [testOnlineOrderId, testPosOrderId] } },
  });
  await prisma.customer.deleteMany({
    where: { id: testCustomerId },
  });
});

afterEach(async () => {
  await prisma.orderItem.deleteMany({
    where: { orderId: { in: [testOnlineOrderId, testPosOrderId] } },
  });
  await prisma.order.deleteMany({
    where: { id: { in: [testOnlineOrderId, testPosOrderId] } },
  });
  await prisma.customer.deleteMany({
    where: { id: testCustomerId },
  });
});

describe("Admin Order Search Query", () => {
  it("matches online order by contact name and contact phone", async () => {
    // 1. Seed POS customer and order
    const customer = await prisma.customer.create({
      data: {
        id: testCustomerId,
        name: "Lê Khách Quầy",
        phone: "0911222333",
      },
    });

    await prisma.order.create({
      data: {
        id: testPosOrderId,
        clientId: "client-search-pos-01",
        code: "ORD-POS-SEARCH-01",
        channel: "pos",
        status: "paid",
        customerId: customer.id,
        total: 50_000,
        subtotal: 50_000,
        discount: 0,
      },
    });

    // 2. Seed Online order with contactName and contactPhone (no POS customer)
    await prisma.order.create({
      data: {
        id: testOnlineOrderId,
        clientId: "client-search-online-01",
        code: "ORD-ONLINE-SEARCH-01",
        channel: "online",
        status: "pending",
        fulfillmentStatus: "new",
        fulfillmentType: "delivery",
        contactName: "Trần Khách Online",
        contactPhone: "0988777666",
        total: 120_000,
        subtotal: 120_000,
        discount: 0,
      },
    });

    // 3. Search by online contact name
    const whereByName = buildOrdersWhere({ q: "Trần Khách" });
    const resultsByName = await prisma.order.findMany({ where: whereByName });
    expect(resultsByName.some((o) => o.id === testOnlineOrderId)).toBe(true);
    expect(resultsByName.some((o) => o.id === testPosOrderId)).toBe(false);

    // 4. Search by online contact phone
    const whereByPhone = buildOrdersWhere({ q: "0988777" });
    const resultsByPhone = await prisma.order.findMany({ where: whereByPhone });
    expect(resultsByPhone.some((o) => o.id === testOnlineOrderId)).toBe(true);
    expect(resultsByPhone.some((o) => o.id === testPosOrderId)).toBe(false);

    // 5. Search by POS customer name
    const whereByPosCust = buildOrdersWhere({ q: "Lê Khách" });
    const resultsByPosCust = await prisma.order.findMany({
      where: whereByPosCust,
    });
    expect(resultsByPosCust.some((o) => o.id === testPosOrderId)).toBe(true);
    expect(resultsByPosCust.some((o) => o.id === testOnlineOrderId)).toBe(
      false,
    );
  });
});

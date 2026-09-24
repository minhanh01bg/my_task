import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildOrdersWhere } from "@/server/admin/list-orders";
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

    // 5. Exact order code (DH + digits) only matches that order
    await prisma.order.update({
      where: { id: testPosOrderId },
      data: { code: "DH990042" },
    });
    const whereByCode = buildOrdersWhere({ q: "DH990042" });
    const resultsByCode = await prisma.order.findMany({ where: whereByCode });
    expect(resultsByCode.map((o) => o.id)).toEqual([testPosOrderId]);

    // 6. Free text also matches part of the order code
    const whereByPartialCode = buildOrdersWhere({ q: "ONLINE-SEARCH" });
    const resultsByPartialCode = await prisma.order.findMany({
      where: whereByPartialCode,
    });
    expect(resultsByPartialCode.map((o) => o.id)).toEqual([testOnlineOrderId]);

    // 7. POS order (linked customer, null contactName/contactPhone) is found
    // by the linked customer's name.
    const whereByCustomerName = buildOrdersWhere({ q: "Lê Khách Quầy" });
    const resultsByCustomerName = await prisma.order.findMany({
      where: whereByCustomerName,
    });
    expect(resultsByCustomerName.some((o) => o.id === testPosOrderId)).toBe(
      true,
    );
    expect(resultsByCustomerName.some((o) => o.id === testOnlineOrderId)).toBe(
      false,
    );

    // 8. POS order is found by the linked customer's phone number.
    const whereByCustomerPhone = buildOrdersWhere({ q: "0911222" });
    const resultsByCustomerPhone = await prisma.order.findMany({
      where: whereByCustomerPhone,
    });
    expect(resultsByCustomerPhone.some((o) => o.id === testPosOrderId)).toBe(
      true,
    );
    expect(resultsByCustomerPhone.some((o) => o.id === testOnlineOrderId)).toBe(
      false,
    );

    // 9. A `+84…` query also matches phone numbers stored in `0…` form
    // (both the linked customer's phone and an online order's contactPhone).
    const whereByPlus84 = buildOrdersWhere({ q: "+84911222333" });
    const resultsByPlus84 = await prisma.order.findMany({
      where: whereByPlus84,
    });
    expect(resultsByPlus84.some((o) => o.id === testPosOrderId)).toBe(true);

    const whereByPlus84Online = buildOrdersWhere({ q: "+84988777666" });
    const resultsByPlus84Online = await prisma.order.findMany({
      where: whereByPlus84Online,
    });
    expect(resultsByPlus84Online.some((o) => o.id === testOnlineOrderId)).toBe(
      true,
    );
  });
});

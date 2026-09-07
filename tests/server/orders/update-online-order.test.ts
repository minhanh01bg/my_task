import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  markOnlineOrderPaid,
  transitionOnlineOrder,
} from "@/server/orders/update-online-order";

const testOrderId = "test-order-update-123";

beforeEach(async () => {
  await prisma.payment.deleteMany({ where: { orderId: testOrderId } });
  await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
  await prisma.order.deleteMany({ where: { id: testOrderId } });
});

afterEach(async () => {
  await prisma.payment.deleteMany({ where: { orderId: testOrderId } });
  await prisma.orderItem.deleteMany({ where: { orderId: testOrderId } });
  await prisma.order.deleteMany({ where: { id: testOrderId } });
});

describe("Online Order Status & Payment Updates", () => {
  it("transitions order through valid fulfillment status lifecycle", async () => {
    await prisma.order.create({
      data: {
        id: testOrderId,
        clientId: "client-id-01",
        code: "ORD-UPDATE-01",
        channel: "online",
        status: "pending",
        fulfillmentStatus: "new",
        fulfillmentType: "pickup",
        total: 100_000,
        subtotal: 100_000,
        discount: 0,
      },
    });

    // new -> confirmed
    await transitionOnlineOrder(testOrderId, "confirmed");
    let order = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(order?.fulfillmentStatus).toBe("confirmed");

    // confirmed -> preparing
    await transitionOnlineOrder(testOrderId, "preparing");
    order = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(order?.fulfillmentStatus).toBe("preparing");

    // preparing -> ready
    await transitionOnlineOrder(testOrderId, "ready");
    order = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(order?.fulfillmentStatus).toBe("ready");

    // ready -> completed
    await transitionOnlineOrder(testOrderId, "completed");
    order = await prisma.order.findUnique({ where: { id: testOrderId } });
    expect(order?.fulfillmentStatus).toBe("completed");
  });

  it("rejects invalid state transition according to online state machine", async () => {
    await prisma.order.create({
      data: {
        id: testOrderId,
        clientId: "client-id-02",
        code: "ORD-UPDATE-02",
        channel: "online",
        status: "pending",
        fulfillmentStatus: "new",
        fulfillmentType: "pickup",
        total: 100_000,
        subtotal: 100_000,
        discount: 0,
      },
    });

    // new cannot jump directly to completed
    await expect(
      transitionOnlineOrder(testOrderId, "completed"),
    ).rejects.toThrow("Chuyển trạng thái không hợp lệ");
  });

  it("marks online order as paid and timestamps all pending payments", async () => {
    await prisma.order.create({
      data: {
        id: testOrderId,
        clientId: "client-id-03",
        code: "ORD-UPDATE-03",
        channel: "online",
        status: "pending",
        fulfillmentStatus: "new",
        fulfillmentType: "pickup",
        total: 100_000,
        subtotal: 100_000,
        discount: 0,
        payments: {
          create: {
            method: "cod",
            amount: 100_000,
            receivedAt: null,
          },
        },
      },
    });

    await markOnlineOrderPaid(testOrderId);

    const order = await prisma.order.findUnique({
      where: { id: testOrderId },
      include: { payments: true },
    });

    expect(order?.status).toBe("paid");
    expect(order?.payments[0].receivedAt).toBeDefined();
    expect(order?.payments[0].receivedAt).not.toBeNull();
  });
});

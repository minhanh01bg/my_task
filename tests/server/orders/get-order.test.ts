import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { getOrderDetail } from "@/server/orders/get-order";

describe("getOrderDetail", () => {
  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customer.deleteMany();
  });

  it("trả về thông tin đơn hàng đầy đủ kèm customer, items và payments", async () => {
    const customer = await prisma.customer.create({
      data: { name: "Nguyễn Văn A", phone: "0901234567" },
    });

    const order = await prisma.order.create({
      data: {
        code: "DH001",
        clientId: "test_client_order_1",
        channel: "online",
        status: "paid",
        subtotal: 100_000,
        discount: 0,
        shippingFee: 20_000,
        total: 120_000,
        customerId: customer.id,
        items: {
          create: [
            {
              nameSnapshot: "Cà phê đen",
              unitPrice: 50_000,
              originalPrice: 50_000,
              quantity: 2,
              lineTotal: 100_000,
            },
          ],
        },
        payments: {
          create: [
            {
              method: "transfer",
              amount: 120_000,
            },
          ],
        },
      },
    });

    const detail = await getOrderDetail(order.id);
    expect(detail).not.toBeNull();
    expect(detail?.id).toBe(order.id);
    expect(detail?.customer?.name).toBe("Nguyễn Văn A");
    expect(detail?.items).toHaveLength(1);
    expect(detail?.items[0].nameSnapshot).toBe("Cà phê đen");
    expect(detail?.payments).toHaveLength(1);
    expect(detail?.payments[0].amount).toBe(120_000);
  });

  it("trả về null khi không tìm thấy đơn", async () => {
    const detail = await getOrderDetail("non_existent_id");
    expect(detail).toBeNull();
  });
});

import { Prisma, PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { logger } from "@/lib/logger";
import { prisma as appPrisma } from "@/server/db/prisma";
import { createOrder } from "@/server/orders/create-order";
import { generateOrderCode } from "@/server/orders/order-code";
import { ORDER_SEQUENCE_KEY } from "@/server/orders/order-sequence";

const prisma = new PrismaClient();

async function seedProduct(
  overrides: { name?: string; price?: number; stock?: number } = {},
) {
  return prisma.product.create({
    data: {
      name: overrides.name ?? "Đường trắng",
      price: overrides.price ?? 15000,
      stock: overrides.stock ?? 10,
      unit: "kg",
      searchText: "duong trang",
    },
  });
}

function cashLine(productId: string, overrides: Record<string, unknown> = {}) {
  return {
    productId,
    name: "Đường trắng",
    unitPrice: 15000,
    originalPrice: 15000,
    quantity: 2,
    discount: 0,
    unit: "kg",
    isService: false,
    ...overrides,
  };
}

beforeEach(async () => {
  await prisma.adminNotification.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function setSequence(value: number) {
  await prisma.setting.upsert({
    where: { key: ORDER_SEQUENCE_KEY },
    create: { key: ORDER_SEQUENCE_KEY, value: String(value) },
    update: { value: String(value) },
  });
}

function uniqueViolation(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: Prisma.prismaVersion.client,
    meta: { target },
  });
}

describe("generateOrderCode", () => {
  it("sinh ma dang DH + 4 chu so", () => {
    expect(generateOrderCode(1)).toBe("DH0001");
    expect(generateOrderCode(1042)).toBe("DH1042");
  });

  it("khong cat bot khi vuot 4 chu so", () => {
    expect(generateOrderCode(12345)).toBe("DH12345");
  });
});

describe("createOrder", () => {
  it("tao don va tinh tong tu server", async () => {
    const product = await seedProduct();

    const result = await createOrder({
      clientId: "c1",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(result.duplicated).toBe(false);
    expect(result.order.total).toBe(30000);
    expect(result.order.code).toMatch(/^DH\d+$/);
    expect(result.order.status).toBe("paid");
    expect(await prisma.adminNotification.count()).toBe(0);
  });

  it("BO QUA tong tien do client gui, tinh lai tu dau", async () => {
    const product = await seedProduct({ price: 15000 });

    const result = await createOrder({
      clientId: "c2",
      // client noi doi don gia 1 dong; server van dung don gia trong payload
      // nhung tu nhan lai va tu lam tron
      lines: [cashLine(product.id, { unitPrice: 15000, quantity: 2.5 })],
      payments: [{ method: "cash", amount: 100000 }],
    });

    expect(result.order.total).toBe(37500);
  });

  it("tru ton kho theo so luong ban", async () => {
    const product = await seedProduct({ stock: 10 });

    await createOrder({
      clientId: "c3",
      lines: [cashLine(product.id, { quantity: 2.5 })],
      payments: [{ method: "cash", amount: 40000 }],
    });

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(after.stock).toBe(7.5);
    expect(after.soldCount).toBe(1);
  });

  it("ghi StockMovement cho moi dong hang hoa", async () => {
    const product = await seedProduct();

    const result = await createOrder({
      clientId: "c4",
      lines: [cashLine(product.id, { quantity: 2 })],
      payments: [{ method: "cash", amount: 30000 }],
    });

    const movements = await prisma.stockMovement.findMany();
    expect(movements).toHaveLength(1);
    expect(movements[0]?.delta).toBe(-2);
    expect(movements[0]?.reason).toBe("sale");
    expect(movements[0]?.refId).toBe(result.order.id);
  });

  it("dong dich vu KHONG tru ton va khong ghi StockMovement", async () => {
    const result = await createOrder({
      clientId: "c5",
      lines: [
        {
          productId: null,
          name: "Công thay nhớt",
          unitPrice: 20000,
          originalPrice: 20000,
          quantity: 1,
          discount: 0,
          unit: "lần",
          isService: true,
        },
      ],
      payments: [{ method: "cash", amount: 20000 }],
    });

    expect(result.order.total).toBe(20000);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("cho ton am nhung danh dau canh bao", async () => {
    const product = await seedProduct({ stock: 1 });

    const result = await createOrder({
      clientId: "c6",
      lines: [cashLine(product.id, { quantity: 3 })],
      payments: [{ method: "cash", amount: 50000 }],
    });

    expect(result.order.hasStockWarning).toBe(true);
    const after = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(after.stock).toBe(-2);
  });

  it("chong trung don theo clientId — goi hai lan chi tao mot don", async () => {
    const product = await seedProduct();
    const input = {
      clientId: "same-client-id",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash" as const, amount: 30000 }],
    };

    const first = await createOrder(input);
    const second = await createOrder(input);

    expect(second.duplicated).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(await prisma.order.count()).toBe(1);
    // quan trong: khong tru ton hai lan
    const after = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(after.stock).toBe(8);
  });

  it("luu nameSnapshot va originalPrice tren tung dong", async () => {
    const product = await seedProduct({ name: "Đường trắng" });

    const result = await createOrder({
      clientId: "c8",
      lines: [cashLine(product.id, { unitPrice: 12000, originalPrice: 15000 })],
      payments: [{ method: "cash", amount: 24000 }],
    });

    const items = await prisma.orderItem.findMany({
      where: { orderId: result.order.id },
    });
    expect(items[0]?.nameSnapshot).toBe("Đường trắng");
    expect(items[0]?.unitPrice).toBe(12000);
    expect(items[0]?.originalPrice).toBe(15000);
  });

  it("don ghi no co status debt", async () => {
    const product = await seedProduct();

    const result = await createOrder({
      clientId: "c9",
      lines: [cashLine(product.id)],
      payments: [{ method: "debt", amount: 30000 }],
    });

    expect(result.order.status).toBe("debt");
  });

  it("gio rong bi tu choi", async () => {
    await expect(
      createOrder({ clientId: "c10", lines: [], payments: [] }),
    ).rejects.toThrow(/rỗng/i);
  });

  it("dung ma don do may ban dat truoc", async () => {
    const product = await seedProduct();

    const result = await createOrder({
      clientId: "pref1",
      preferredCode: "DH7777",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(result.order.code).toBe("DH7777");
  });

  it("ma dat truoc bi trung thi tu sinh ma khac", async () => {
    const product = await seedProduct();

    await createOrder({
      clientId: "pref2",
      preferredCode: "DH8888",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    const second = await createOrder({
      clientId: "pref3",
      preferredCode: "DH8888",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(second.order.code).not.toBe("DH8888");
    expect(second.order.code).toMatch(/^DH\d+$/);
  });

  it("khong dat truoc thi van sinh ma tu dong", async () => {
    const product = await seedProduct();

    const result = await createOrder({
      clientId: "pref4",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(result.order.code).toMatch(/^DH\d+$/);
  });

  it("ma dat truoc bi trung thi dung ma tu bo dem", async () => {
    const product = await seedProduct();
    await createOrder({
      clientId: "pref5",
      preferredCode: "DH9001",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });
    await setSequence(41);

    const second = await createOrder({
      clientId: "pref6",
      preferredCode: "DH9001",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(second.duplicated).toBe(false);
    expect(second.order.code).toBe("DH0042");
  });

  it("ma tu bo dem da bi ma dat truoc chiem thi nhay sang so ke tiep", async () => {
    const product = await seedProduct();
    await createOrder({
      clientId: "seq-taken-1",
      preferredCode: "DH0005",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });
    await setSequence(4);

    const result = await createOrder({
      clientId: "seq-taken-2",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(result.order.code).toBe("DH0006");
  });

  it("10 don song song: tat ca thanh cong, ma khac nhau va lien tiep", async () => {
    const product = await seedProduct({ stock: 100 });
    await setSequence(200);

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createOrder({
          clientId: `parallel-${index}`,
          lines: [cashLine(product.id, { quantity: 1 })],
          payments: [{ method: "cash", amount: 15000 }],
        }),
      ),
    );

    expect(results.every((result) => !result.duplicated)).toBe(true);
    const codes = results.map((result) => result.order.code).sort();
    expect(new Set(codes).size).toBe(10);
    expect(codes).toEqual(
      Array.from({ length: 10 }, (_, index) => generateOrderCode(201 + index)),
    );
    expect(await prisma.order.count()).toBe(10);
    expect(await prisma.stockMovement.count()).toBe(10);
    const after = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(after.stock).toBe(90);
  });

  it("P2002 tren code thi thu lai toan bo transaction", async () => {
    const product = await seedProduct();
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const spy = vi
      .spyOn(appPrisma, "$transaction")
      .mockRejectedValueOnce(uniqueViolation(["code"]));

    const result = await createOrder({
      clientId: "retry-code",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(result.duplicated).toBe(false);
    expect(await prisma.order.count()).toBe(1);
  });

  it("P2002 tren code lap lai qua 3 lan thi nem loi", async () => {
    const product = await seedProduct();
    vi.spyOn(logger, "warn").mockImplementation(() => {});
    const spy = vi
      .spyOn(appPrisma, "$transaction")
      .mockRejectedValue(uniqueViolation(["code"]));

    await expect(
      createOrder({
        clientId: "retry-exhausted",
        lines: [cashLine(product.id)],
        payments: [{ method: "cash", amount: 30000 }],
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    expect(spy).toHaveBeenCalledTimes(3);
    expect(await prisma.order.count()).toBe(0);
  });

  it("P2002 tren clientId thi tra ve don da ton tai, khong thu lai", async () => {
    const product = await seedProduct();
    const spy = vi
      .spyOn(appPrisma, "$transaction")
      .mockImplementationOnce(async () => {
        await prisma.order.create({
          data: { code: "DH6060", clientId: "race-client", total: 30000 },
        });
        throw uniqueViolation(["clientId"]);
      });

    const result = await createOrder({
      clientId: "race-client",
      lines: [cashLine(product.id)],
      payments: [{ method: "cash", amount: 30000 }],
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.duplicated).toBe(true);
    expect(result.order.code).toBe("DH6060");
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  ORDER_SEQUENCE_KEY,
  nextOrderSequence,
} from "@/server/orders/order-sequence";

async function next(): Promise<number> {
  return prisma.$transaction((tx) => nextOrderSequence(tx));
}

async function seedOrder(code: string) {
  return prisma.order.create({
    data: { code, clientId: `seq-${code}` },
  });
}

async function storedValue(): Promise<string | undefined> {
  const row = await prisma.setting.findUnique({
    where: { key: ORDER_SEQUENCE_KEY },
  });
  return row?.value;
}

beforeEach(async () => {
  await prisma.setting.deleteMany({ where: { key: ORDER_SEQUENCE_KEY } });
  await prisma.order.deleteMany();
});

afterAll(async () => {
  await prisma.setting.deleteMany({ where: { key: ORDER_SEQUENCE_KEY } });
});

describe("nextOrderSequence", () => {
  it("DB trong: bat dau tu 1 roi tang dan", async () => {
    expect(await next()).toBe(1);
    expect(await next()).toBe(2);
    expect(await next()).toBe(3);
    expect(await storedValue()).toBe("3");
  });

  it("chua co hang Setting nhung da co don: seed tu ma DH lon nhat + 1", async () => {
    await seedOrder("DH0007");
    await seedOrder("DH0042");
    await seedOrder("KHAC9999");

    expect(await next()).toBe(43);
    expect(await storedValue()).toBe("43");
    expect(await next()).toBe(44);
  });

  it("da co hang Setting: tang tu gia tri dang luu, khong seed lai", async () => {
    await prisma.setting.create({
      data: { key: ORDER_SEQUENCE_KEY, value: "100" },
    });
    await seedOrder("DH0500");

    expect(await next()).toBe(101);
    expect(await storedValue()).toBe("101");
  });

  it("transaction rollback thi khong tieu so thu tu", async () => {
    expect(await next()).toBe(1);

    await expect(
      prisma.$transaction(async (tx) => {
        await nextOrderSequence(tx);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");

    expect(await next()).toBe(2);
  });
});

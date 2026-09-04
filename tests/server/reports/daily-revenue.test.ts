import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  getDailyRevenue,
  getLowStockProducts,
  getTopProducts,
} from "@/server/reports/daily-revenue";

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createOrderAt(total: number, createdAt: Date, status = "paid") {
  await prisma.order.create({
    data: {
      code: `DH${Math.random().toString().slice(2, 8)}`,
      clientId: crypto.randomUUID(),
      status,
      subtotal: total,
      total,
      createdAt,
    },
  });
}

describe("getDailyRevenue", () => {
  it("khong co don thi tra ve mang rong", async () => {
    expect(await getDailyRevenue(7)).toEqual([]);
  });

  it("cong don doanh thu theo ngay", async () => {
    const today = new Date();
    await createOrderAt(100000, today);
    await createOrderAt(50000, today);

    const rows = await getDailyRevenue(7);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.orderCount).toBe(2);
    expect(rows[0]?.revenue).toBe(150000);
  });

  it("tach rieng tung ngay", async () => {
    const today = new Date();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await createOrderAt(100000, today);
    await createOrderAt(70000, yesterday);

    const rows = await getDailyRevenue(7);
    expect(rows).toHaveLength(2);
  });

  it("KHONG tinh don da huy vao doanh thu", async () => {
    const today = new Date();
    await createOrderAt(100000, today);
    await createOrderAt(999000, today, "cancelled");

    const rows = await getDailyRevenue(7);
    expect(rows[0]?.revenue).toBe(100000);
  });

  it("bo qua don ngoai khoang ngay yeu cau", async () => {
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await createOrderAt(100000, longAgo);

    expect(await getDailyRevenue(7)).toEqual([]);
  });
});

describe("getTopProducts", () => {
  it("xep theo so lan ban giam dan", async () => {
    await prisma.product.createMany({
      data: [
        { name: "Ít bán", price: 1000, searchText: "it ban", soldCount: 2 },
        { name: "Bán chạy", price: 1000, searchText: "ban chay", soldCount: 50 },
      ],
    });

    const rows = await getTopProducts(10);
    expect(rows[0]?.name).toBe("Bán chạy");
  });

  it("gioi han so dong tra ve", async () => {
    await prisma.product.createMany({
      data: Array.from({ length: 20 }, (_, index) => ({
        name: `SP ${index}`,
        price: 1000,
        searchText: `sp ${index}`,
        soldCount: index,
      })),
    });

    expect(await getTopProducts(5)).toHaveLength(5);
  });
});

describe("getLowStockProducts", () => {
  it("chi lay hang duoi nguong", async () => {
    await prisma.product.createMany({
      data: [
        { name: "Sắp hết", price: 1000, searchText: "sap het", stock: 2, unit: "cái" },
        { name: "Còn nhiều", price: 1000, searchText: "con nhieu", stock: 50, unit: "cái" },
      ],
    });

    const rows = await getLowStockProducts(5);
    expect(rows.map((row) => row.name)).toEqual(["Sắp hết"]);
  });

  it("bao gom ca hang bi ton am", async () => {
    await prisma.product.create({
      data: { name: "Âm kho", price: 1000, searchText: "am kho", stock: -3, unit: "cái" },
    });

    const rows = await getLowStockProducts(5);
    expect(rows[0]?.stock).toBe(-3);
  });

  it("bo qua hang da xoa mem", async () => {
    await prisma.product.create({
      data: {
        name: "Đã xoá",
        price: 1000,
        searchText: "da xoa",
        stock: 1,
        unit: "cái",
        deletedAt: new Date(),
      },
    });

    expect(await getLowStockProducts(5)).toEqual([]);
  });
});

import { PrismaClient } from "@prisma/client";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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

async function createOrderAt(
  total: number,
  createdAt: Date,
  status = "paid",
  channel: "pos" | "online" = "pos",
) {
  await prisma.order.create({
    data: {
      code: `DH${Math.random().toString().slice(2, 8)}`,
      clientId: crypto.randomUUID(),
      status,
      channel,
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

describe("getDailyRevenue — gio Viet Nam (Asia/Ho_Chi_Minh, +7)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 12:00 ngay 20/09 gio VN
    vi.setSystemTime(new Date("2026-09-20T05:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("don luc 02:00 UTC ngay N thuoc ngay N theo gio VN (09:00)", async () => {
    await createOrderAt(100000, new Date("2026-09-18T02:00:00Z"));

    const rows = await getDailyRevenue(7);
    expect(rows.map((row) => row.date)).toEqual(["2026-09-18"]);
  });

  it("don luc 18:00 UTC ngay N thuoc ngay N+1 theo gio VN (01:00)", async () => {
    await createOrderAt(100000, new Date("2026-09-18T18:00:00Z"));

    const rows = await getDailyRevenue(7);
    expect(rows.map((row) => row.date)).toEqual(["2026-09-19"]);
  });

  it("tach doanh thu theo kenh pos/online cho moi ngay", async () => {
    await createOrderAt(
      100000,
      new Date("2026-09-19T03:00:00Z"),
      "paid",
      "pos",
    );
    await createOrderAt(40000, new Date("2026-09-19T04:00:00Z"), "paid", "pos");
    await createOrderAt(
      70000,
      new Date("2026-09-19T05:00:00Z"),
      "pending",
      "online",
    );
    await createOrderAt(
      999000,
      new Date("2026-09-19T06:00:00Z"),
      "cancelled",
      "online",
    );

    const rows = await getDailyRevenue(7);
    expect(rows).toEqual([
      {
        date: "2026-09-19",
        orderCount: 3,
        revenue: 210000,
        byChannel: { pos: 140000, online: 70000 },
      },
    ]);
  });

  it("khoang ngay bat dau tu 00:00 gio VN cua ngay dau tien", async () => {
    // days=7, hom nay 20/09 => tu 00:00 VN 14/09 = 17:00 UTC 13/09
    await createOrderAt(10000, new Date("2026-09-13T17:30:00Z"));
    await createOrderAt(20000, new Date("2026-09-13T16:30:00Z"));

    const rows = await getDailyRevenue(7);
    expect(rows.map((row) => [row.date, row.revenue])).toEqual([
      ["2026-09-14", 10000],
    ]);
  });

  it("mac dinh lay 14 ngay", async () => {
    // 00:00 VN 07/09 = 17:00 UTC 06/09
    await createOrderAt(10000, new Date("2026-09-06T17:30:00Z"));
    await createOrderAt(20000, new Date("2026-09-06T16:30:00Z"));

    const rows = await getDailyRevenue();
    expect(rows.map((row) => row.date)).toEqual(["2026-09-07"]);
  });

  it("ho tro 30 ngay", async () => {
    await createOrderAt(10000, new Date("2026-08-22T03:00:00Z"));
    await createOrderAt(20000, new Date("2026-08-20T03:00:00Z"));

    const rows = await getDailyRevenue(30);
    expect(rows.map((row) => row.date)).toEqual(["2026-08-22"]);
  });
});

describe("getTopProducts", () => {
  it("xep theo so lan ban giam dan", async () => {
    await prisma.product.createMany({
      data: [
        { name: "Ít bán", price: 1000, searchText: "it ban", soldCount: 2 },
        {
          name: "Bán chạy",
          price: 1000,
          searchText: "ban chay",
          soldCount: 50,
        },
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
        {
          name: "Sắp hết",
          price: 1000,
          searchText: "sap het",
          stock: 2,
          unit: "cái",
        },
        {
          name: "Còn nhiều",
          price: 1000,
          searchText: "con nhieu",
          stock: 50,
          unit: "cái",
        },
      ],
    });

    const rows = await getLowStockProducts(5);
    expect(rows.map((row) => row.name)).toEqual(["Sắp hết"]);
  });

  it("bao gom ca hang bi ton am", async () => {
    await prisma.product.create({
      data: {
        name: "Âm kho",
        price: 1000,
        searchText: "am kho",
        stock: -3,
        unit: "cái",
      },
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

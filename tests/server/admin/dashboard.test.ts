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

import { getDashboardSummary } from "@/server/admin/dashboard";

const prisma = new PrismaClient();

let orderSeq = 0;

interface OrderInput {
  total: number;
  createdAt: Date;
  status?: string;
  channel?: "pos" | "online";
  fulfillmentStatus?: string | null;
  contactName?: string | null;
}

async function createOrder({
  total,
  createdAt,
  status = "paid",
  channel = "pos",
  fulfillmentStatus = null,
  contactName = null,
}: OrderInput) {
  orderSeq += 1;
  return prisma.order.create({
    data: {
      code: `DH${String(orderSeq).padStart(6, "0")}`,
      clientId: crypto.randomUUID(),
      status,
      channel,
      subtotal: total,
      total,
      createdAt,
      fulfillmentStatus,
      contactName,
    },
    select: { id: true, code: true },
  });
}

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  // 01:30 ngay 25/09 gio VN = 18:30 UTC ngay 24/09
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-24T18:30:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getDashboardSummary", () => {
  it("cua hang trong: moi con so bang 0, bieu do van du 7 ngay", async () => {
    const summary = await getDashboardSummary();

    expect(summary.today).toEqual({ revenue: 0, orderCount: 0 });
    expect(summary.awaitingOnlineCount).toBe(0);
    expect(summary.lowStockCount).toBe(0);
    expect(summary.latestOnlineOrders).toEqual([]);
    expect(summary.lowStockProducts).toEqual([]);
    expect(summary.week.map((point) => point.date)).toEqual([
      "2026-09-19",
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
    ]);
    expect(summary.week.every((point) => point.revenue === 0)).toBe(true);
  });

  it("doanh thu va so don hom nay tinh theo ngay gio Viet Nam, bo don huy", async () => {
    // 00:30 ngay 25/09 VN — hom nay
    await createOrder({
      total: 100_000,
      createdAt: new Date("2026-09-24T17:30:00Z"),
    });
    await createOrder({
      total: 50_000,
      createdAt: new Date("2026-09-24T18:00:00Z"),
      channel: "online",
      status: "pending",
      fulfillmentStatus: "new",
    });
    // 23:30 ngay 24/09 VN — hom qua
    await createOrder({
      total: 70_000,
      createdAt: new Date("2026-09-24T16:30:00Z"),
    });
    // Don huy hom nay khong tinh
    await createOrder({
      total: 999_000,
      createdAt: new Date("2026-09-24T18:10:00Z"),
      status: "cancelled",
    });

    const summary = await getDashboardSummary();

    expect(summary.today).toEqual({ revenue: 150_000, orderCount: 2 });
    const byDate = new Map(summary.week.map((p) => [p.date, p.revenue]));
    expect(byDate.get("2026-09-25")).toBe(150_000);
    expect(byDate.get("2026-09-24")).toBe(70_000);
  });

  it("dem don online cho xu ly (new, confirmed) va lay 5 don online moi nhat", async () => {
    const base = new Date("2026-09-24T10:00:00Z").getTime();
    const statuses = [
      "new",
      "confirmed",
      "preparing",
      "completed",
      "new",
      "cancelled",
      "confirmed",
    ];
    const created: { id: string; code: string }[] = [];
    for (const [index, fulfillmentStatus] of statuses.entries()) {
      created.push(
        await createOrder({
          total: 10_000 * (index + 1),
          createdAt: new Date(base + index * 60_000),
          channel: "online",
          status: fulfillmentStatus === "cancelled" ? "cancelled" : "pending",
          fulfillmentStatus,
          contactName: `Khách ${index}`,
        }),
      );
    }
    // Huy tu /admin/orders chi doi status — van con fulfillmentStatus "new"
    await createOrder({
      total: 1_000,
      createdAt: new Date(base - 60_000),
      channel: "online",
      status: "cancelled",
      fulfillmentStatus: "new",
    });
    // Don POS khong bao gio la "don online"
    await createOrder({
      total: 5_000,
      createdAt: new Date(base + 60 * 60_000),
    });

    const summary = await getDashboardSummary();

    expect(summary.awaitingOnlineCount).toBe(4);
    expect(summary.latestOnlineOrders.map((order) => order.code)).toEqual(
      created
        .slice(-5)
        .reverse()
        .map((order) => order.code),
    );
    expect(summary.latestOnlineOrders[0]).toEqual({
      id: created[6]?.id,
      code: created[6]?.code,
      total: 70_000,
      status: "pending",
      fulfillmentStatus: "confirmed",
      contactName: "Khách 6",
      createdAt: new Date(base + 6 * 60_000),
    });
  });

  it("dem va liet ke hang sap het giong trang san pham (bo dich vu, hang da xoa)", async () => {
    await prisma.product.createMany({
      data: [
        { name: "Âm kho", stock: -2, searchText: "am kho" },
        { name: "Hết", stock: 0, searchText: "het" },
        { name: "Còn 1", stock: 1, searchText: "con 1" },
        { name: "Còn 3", stock: 3, searchText: "con 3" },
        { name: "Còn 4", stock: 4, searchText: "con 4" },
        { name: "Còn 5", stock: 5, searchText: "con 5" },
        { name: "Còn nhiều", stock: 50, searchText: "con nhieu" },
        {
          name: "Dịch vụ",
          stock: 0,
          isService: true,
          searchText: "dich vu",
        },
        {
          name: "Đã xoá",
          stock: 0,
          deletedAt: new Date(),
          searchText: "da xoa",
        },
      ],
    });

    const summary = await getDashboardSummary();

    expect(summary.lowStockCount).toBe(6);
    expect(summary.lowStockProducts.map((product) => product.name)).toEqual([
      "Âm kho",
      "Hết",
      "Còn 1",
      "Còn 3",
      "Còn 4",
    ]);
    expect(Object.keys(summary.lowStockProducts[0] ?? {}).sort()).toEqual([
      "id",
      "name",
      "stock",
      "unit",
    ]);
  });
});

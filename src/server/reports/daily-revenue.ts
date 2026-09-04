import { prisma } from "@/server/db/prisma";

export interface DailyRevenueRow {
  /** Dang YYYY-MM-DD. */
  date: string;
  orderCount: number;
  revenue: number;
}

export interface TopProductRow {
  id: string;
  name: string;
  soldCount: number;
}

export interface LowStockRow {
  id: string;
  name: string;
  stock: number;
  unit: string;
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * Doanh thu theo ngay. Don da huy KHONG duoc tinh — neu tinh thi con so
 * bao cao se cao hon tien that trong ket.
 */
export async function getDailyRevenue(
  days: number,
): Promise<DailyRevenueRow[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { not: "cancelled" } },
    select: { createdAt: true, total: true },
  });

  const byDate = new Map<string, { orderCount: number; revenue: number }>();

  for (const order of orders) {
    const key = toDateKey(order.createdAt);
    const current = byDate.get(key) ?? { orderCount: 0, revenue: 0 };
    byDate.set(key, {
      orderCount: current.orderCount + 1,
      revenue: current.revenue + order.total,
    });
  }

  return [...byDate.entries()]
    .map(([date, value]) => ({ date, ...value }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getTopProducts(limit: number): Promise<TopProductRow[]> {
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: { soldCount: "desc" },
    take: limit,
    select: { id: true, name: true, soldCount: true },
  });
}

/** Gom ca hang bi ton am — do la dau hieu can chinh kho gap. */
export async function getLowStockProducts(
  threshold: number,
): Promise<LowStockRow[]> {
  return prisma.product.findMany({
    where: {
      deletedAt: null,
      isService: false,
      stock: { lte: threshold },
    },
    orderBy: { stock: "asc" },
    select: { id: true, name: true, stock: true, unit: true },
  });
}

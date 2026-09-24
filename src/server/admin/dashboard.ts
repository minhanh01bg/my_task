import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { LOW_STOCK_WHERE } from "@/server/products/low-stock";
import {
  getDailyRevenue,
  toVietnamDateKey,
  type LowStockRow,
} from "@/server/reports/daily-revenue";

/** So ngay tren bieu do tong quan — `getDailyRevenue` nhan 7 | 14 | 30. */
const DASHBOARD_DAYS = 7;
const DASHBOARD_LIST_SIZE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Don online dang doi cua hang ra tay: chua xac nhan hoac chua soan hang. */
export const AWAITING_FULFILLMENT_STATUSES = ["new", "confirmed"] as const;

const latestOnlineOrderSelect = {
  id: true,
  code: true,
  total: true,
  status: true,
  fulfillmentStatus: true,
  contactName: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

export type DashboardOnlineOrder = Prisma.OrderGetPayload<{
  select: typeof latestOnlineOrderSelect;
}>;

export interface DashboardDayPoint {
  /** YYYY-MM-DD theo gio Viet Nam. */
  date: string;
  revenue: number;
  orderCount: number;
}

export interface DashboardSummary {
  today: { revenue: number; orderCount: number };
  awaitingOnlineCount: number;
  lowStockCount: number;
  /** 7 ngay gan nhat (tinh ca hom nay), tang dan — ngay khong ban co revenue 0. */
  week: DashboardDayPoint[];
  latestOnlineOrders: DashboardOnlineOrder[];
  lowStockProducts: LowStockRow[];
}

/** Cac khoa ngay VN cua `days` ngay gan nhat, cu nhat truoc. */
function recentVietnamDateKeys(now: Date, days: number): string[] {
  return Array.from({ length: days }, (_, index) =>
    toVietnamDateKey(new Date(now.getTime() - (days - 1 - index) * DAY_MS)),
  );
}

/**
 * Tong quan cho trang /admin. Doanh thu/so don hom nay lay tu cung chuoi
 * `getDailyRevenue(7)` cua bieu do (bo don huy, chia ngay theo gio VN) nen
 * o "Hôm nay" va diem cuoi bieu do luon khop nhau.
 */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const now = new Date();

  const [
    dailyRows,
    awaitingOnlineCount,
    lowStockCount,
    latestOnlineOrders,
    lowStockProducts,
  ] = await Promise.all([
    getDailyRevenue(DASHBOARD_DAYS),
    prisma.order.count({
      where: {
        channel: "online",
        fulfillmentStatus: { in: [...AWAITING_FULFILLMENT_STATUSES] },
        // Huy don tu /admin/orders chi doi `status`, giu nguyen fulfillmentStatus.
        status: { not: "cancelled" },
      },
    }),
    prisma.product.count({ where: LOW_STOCK_WHERE }),
    prisma.order.findMany({
      where: { channel: "online" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: DASHBOARD_LIST_SIZE,
      select: latestOnlineOrderSelect,
    }),
    prisma.product.findMany({
      where: LOW_STOCK_WHERE,
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      take: DASHBOARD_LIST_SIZE,
      select: { id: true, name: true, stock: true, unit: true },
    }),
  ]);

  const byDate = new Map(dailyRows.map((row) => [row.date, row]));
  const week = recentVietnamDateKeys(now, DASHBOARD_DAYS).map((date) => ({
    date,
    revenue: byDate.get(date)?.revenue ?? 0,
    orderCount: byDate.get(date)?.orderCount ?? 0,
  }));
  const todayRow = byDate.get(toVietnamDateKey(now));

  return {
    today: {
      revenue: todayRow?.revenue ?? 0,
      orderCount: todayRow?.orderCount ?? 0,
    },
    awaitingOnlineCount,
    lowStockCount,
    week,
    latestOnlineOrders,
    lowStockProducts,
  };
}

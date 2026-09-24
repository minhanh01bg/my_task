import { prisma } from "@/server/db/prisma";

export const REPORT_DAY_OPTIONS = [7, 14, 30] as const;
export type ReportDays = (typeof REPORT_DAY_OPTIONS)[number];
export const DEFAULT_REPORT_DAYS: ReportDays = 14;

export interface DailyRevenueRow {
  /** Dang YYYY-MM-DD, theo ngay gio Viet Nam (Asia/Ho_Chi_Minh). */
  date: string;
  orderCount: number;
  revenue: number;
  /** Doanh thu tach theo kenh ban. */
  byChannel: { pos: number; online: number };
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

/** Viet Nam khong co gio mua he — luon UTC+7. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Khoa ngay theo gio Viet Nam: 18:00 UTC ngay N la 01:00 ngay N+1 o VN. */
export function toVietnamDateKey(value: Date): string {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

/** Khoa ngay VN cua `days` ngay gan nhat (tinh ca hom nay), cu nhat truoc. */
export function listVietnamDateKeys(
  days: number,
  now: Date = new Date(),
): string[] {
  return Array.from({ length: days }, (_, index) =>
    toVietnamDateKey(new Date(now.getTime() - (days - 1 - index) * DAY_MS)),
  );
}

/** 00:00 gio VN cua ngay som nhat trong ky `days` ngay (tinh ca hom nay). */
function vietnamPeriodStart(now: Date, days: number): Date {
  const vietnamNow = now.getTime() + VIETNAM_OFFSET_MS;
  const vietnamMidnight = vietnamNow - (vietnamNow % DAY_MS);
  return new Date(vietnamMidnight - (days - 1) * DAY_MS - VIETNAM_OFFSET_MS);
}

export function parseReportDays(value: string | undefined): ReportDays {
  const parsed = Number(value);
  return (
    REPORT_DAY_OPTIONS.find((option) => option === parsed) ??
    DEFAULT_REPORT_DAYS
  );
}

/**
 * Doanh thu theo ngay (gio Viet Nam). Don da huy KHONG duoc tinh — neu tinh
 * thi con so bao cao se cao hon tien that trong ket.
 */
export async function getDailyRevenue(
  days: ReportDays = DEFAULT_REPORT_DAYS,
): Promise<DailyRevenueRow[]> {
  const since = vietnamPeriodStart(new Date(), days);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: since }, status: { not: "cancelled" } },
    select: { createdAt: true, total: true, channel: true },
  });

  const byDate = new Map<string, Omit<DailyRevenueRow, "date">>();

  for (const order of orders) {
    const key = toVietnamDateKey(order.createdAt);
    const current = byDate.get(key) ?? {
      orderCount: 0,
      revenue: 0,
      byChannel: { pos: 0, online: 0 },
    };
    const channel = order.channel === "online" ? "online" : "pos";
    byDate.set(key, {
      orderCount: current.orderCount + 1,
      revenue: current.revenue + order.total,
      byChannel: {
        ...current.byChannel,
        [channel]: current.byChannel[channel] + order.total,
      },
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

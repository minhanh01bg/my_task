import { errorLogFields, logger } from "@/lib/logger";
import { getDashboardSummary } from "@/server/admin/dashboard";
import {
  REPORT_DAY_OPTIONS,
  type ReportDays,
} from "@/server/reports/daily-revenue";

import { DashboardStats } from "./dashboard-stats";
import { LowStockList } from "./low-stock-list";
import { RecentOnlineOrders } from "./recent-online-orders";
import { SalesAnalyticsSection } from "./sales-analytics-section";

/** Phan co so lieu cua /admin — trang boc trong Suspense de tieu de hien ngay. */
export async function DashboardSection({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const value = Array.isArray(params.days) ? params.days[0] : params.days;
  const days: ReportDays =
    REPORT_DAY_OPTIONS.find((option) => option === Number(value)) ?? 7;
  const summary = await getDashboardSummary(days).catch((error: unknown) => {
    logger.error("admin_dashboard_summary_failed", errorLogFields(error));
    throw error;
  });

  return (
    <div className="space-y-6">
      <DashboardStats summary={summary} />
      <SalesAnalyticsSection analytics={summary.analytics} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentOnlineOrders orders={summary.latestOnlineOrders} />
        <LowStockList products={summary.lowStockProducts} />
      </div>
    </div>
  );
}

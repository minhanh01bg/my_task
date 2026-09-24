import { logger } from "@/lib/logger";
import { getDashboardSummary } from "@/server/admin/dashboard";

import { DashboardStats } from "./dashboard-stats";
import { LowStockList } from "./low-stock-list";
import { RecentOnlineOrders } from "./recent-online-orders";
import { WeeklyRevenueChart } from "./weekly-revenue-chart";

/** Phan co so lieu cua /admin — trang boc trong Suspense de tieu de hien ngay. */
export async function DashboardSection() {
  const summary = await getDashboardSummary().catch((error: unknown) => {
    logger.error("admin_dashboard_summary_failed", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  });

  return (
    <div className="space-y-6">
      <DashboardStats summary={summary} />
      <WeeklyRevenueChart week={summary.week} />
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentOnlineOrders orders={summary.latestOnlineOrders} />
        <LowStockList products={summary.lowStockProducts} />
      </div>
    </div>
  );
}

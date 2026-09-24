import { StatTile } from "@/components/kit";
import type { DashboardSummary } from "@/server/admin/dashboard";
import { PRODUCT_LOW_STOCK_THRESHOLD } from "@/server/admin/list-products";

interface DashboardStatsProps {
  summary: Pick<
    DashboardSummary,
    "today" | "awaitingOnlineCount" | "lowStockCount"
  >;
}

/** Bon con so chu quan can liec thay dau tien moi sang. */
export function DashboardStats({ summary }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Doanh thu hôm nay"
        value={summary.today.revenue}
        format="money"
        hint="Theo giờ Việt Nam, không tính đơn hủy"
      />
      <StatTile
        label="Đơn hôm nay"
        value={summary.today.orderCount}
        hint="Tại quầy và online"
      />
      <StatTile
        label="Đơn online chờ xử lý"
        value={summary.awaitingOnlineCount}
        hint="Đơn mới và đã xác nhận"
      />
      <StatTile
        label="Sắp hết hàng"
        value={summary.lowStockCount}
        hint={`Còn từ ${PRODUCT_LOW_STOCK_THRESHOLD} trở xuống`}
      />
    </div>
  );
}

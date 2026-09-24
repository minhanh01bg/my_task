import { ChartSvg } from "@/components/kit/chart-svg";
import type { DashboardDayPoint } from "@/server/admin/dashboard";

/** "2026-09-24" -> "24/09" — nhan truc ngang ngan cho 7 diem. */
function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

export function WeeklyRevenueChart({ week }: { week: DashboardDayPoint[] }) {
  return (
    <ChartSvg
      data={week.map((point) => ({
        label: dayLabel(point.date),
        value: point.revenue,
      }))}
      title="Doanh thu 7 ngày"
      subtitle="Tính cả hôm nay, theo giờ Việt Nam"
      valueFormat="vnd-k"
    />
  );
}

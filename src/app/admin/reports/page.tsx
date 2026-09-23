import Link from "next/link";

import { ChartSvg } from "@/components/kit/chart-svg";
import { Money, PageHeader, StatTile } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getDailyRevenue,
  getLowStockProducts,
  getTopProducts,
  parseReportDays,
  REPORT_DAY_OPTIONS,
} from "@/server/reports/daily-revenue";

export const dynamic = "force-dynamic";

interface ReportsPageProps {
  searchParams?: Promise<{ days?: string }>;
}

export default async function ReportsPage({
  searchParams,
}: ReportsPageProps = {}) {
  const params = searchParams ? await searchParams : {};
  const days = parseReportDays(params.days);
  const periodLabel = `${days} ngày gần nhất`;

  const [revenue, topProducts, lowStock] = await Promise.all([
    getDailyRevenue(days),
    getTopProducts(10),
    getLowStockProducts(5),
  ]);

  // Con so tong cua ca ky — chu quan nhin cai la thay, khong phai cong nham.
  const totalRevenue = revenue.reduce((sum, row) => sum + row.revenue, 0);
  const totalOrders = revenue.reduce((sum, row) => sum + row.orderCount, 0);

  const chartData = revenue.map((row) => ({
    label: row.date.slice(5),
    value: row.revenue,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo"
        description="Doanh thu và hàng bán chạy, xem nhanh tình hình cửa hàng."
        action={
          <nav aria-label="Khoảng thời gian báo cáo" className="flex gap-2">
            {REPORT_DAY_OPTIONS.map((option) => (
              <Link
                key={option}
                href={`/admin/reports?days=${option}`}
                aria-current={option === days ? "page" : undefined}
                className={cn(
                  "border-border min-h-11 rounded-xl border px-3 py-2.5 text-sm font-bold",
                  option === days
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted",
                )}
              >
                {option} ngày
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Doanh thu"
          value={totalRevenue}
          format="money"
          hint={periodLabel}
        />
        <StatTile label="Số đơn" value={totalOrders} hint={periodLabel} />
        <StatTile label="Sắp hết hàng" value={lowStock.length} />
      </div>

      <ChartSvg
        data={chartData}
        title="Biểu đồ xu hướng doanh thu"
        subtitle={`Biến động doanh số bán lẻ ${days} ngày qua (giờ Việt Nam)`}
        valueFormat="vnd-k"
      />

      <Card>
        <CardHeader>
          <CardTitle>Doanh thu {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="text-muted-foreground">Chưa có đơn nào</p>
          ) : (
            <ul className="divide-y">
              {revenue.map((row) => (
                <li
                  key={row.date}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2"
                >
                  <span>
                    {row.date}
                    <span className="text-muted-foreground ml-2 text-sm">
                      {row.orderCount} đơn
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums">
                      <Money amount={row.revenue} />
                    </span>
                    <span className="text-muted-foreground block text-sm tabular-nums">
                      Tại quầy <Money amount={row.byChannel.pos} size="sm" /> ·
                      Online <Money amount={row.byChannel.online} size="sm" />
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hàng bán chạy</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {topProducts.map((row) => (
              <li key={row.id} className="flex justify-between py-2">
                <span>{row.name}</span>
                <span className="text-muted-foreground">
                  {row.soldCount} lượt
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sắp hết hàng</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStock.length === 0 ? (
            <p className="text-muted-foreground">Không có hàng nào sắp hết</p>
          ) : (
            <ul className="divide-y">
              {lowStock.map((row) => (
                <li key={row.id} className="flex justify-between py-2">
                  <span>{row.name}</span>
                  {row.stock < 0 ? (
                    <Badge variant="destructive">
                      {row.stock} {row.unit}
                    </Badge>
                  ) : (
                    <span>
                      {row.stock} {row.unit}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { PackageCheck, ReceiptText, TrendingUp } from "lucide-react";

import { EmptyState, Money, PageHeader, StatTile } from "@/components/kit";
import { ChartSvg } from "@/components/kit/chart-svg";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getDailyRevenue,
  getLowStockProducts,
  getTopProducts,
  listVietnamDateKeys,
  parseReportDays,
  REPORT_DAY_OPTIONS,
} from "@/server/reports/daily-revenue";

export const dynamic = "force-dynamic";

const TOP_PRODUCTS_LIMIT = 5;

/** "2026-09-24" -> "24/09". */
function dayLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

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
    getTopProducts(TOP_PRODUCTS_LIMIT),
    getLowStockProducts(5),
  ]);

  // Con so tong cua ca ky — chu quan nhin cai la thay, khong phai cong nham.
  const totalRevenue = revenue.reduce((sum, row) => sum + row.revenue, 0);
  const totalOrders = revenue.reduce((sum, row) => sum + row.orderCount, 0);

  // Moi ngay trong ky mot diem (ngay khong ban = 0), cu nhat ben trai.
  const revenueByDate = new Map(revenue.map((row) => [row.date, row]));
  const chartData = listVietnamDateKeys(days).map((date) => {
    const row = revenueByDate.get(date);
    return {
      label: dayLabel(date),
      value: row?.byChannel.pos ?? 0,
      secondaryValue: row?.byChannel.online ?? 0,
    };
  });

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
        subtitle={`Tại quầy và online, ${days} ngày qua (giờ Việt Nam)`}
        valueFormat="vnd-k"
        seriesLabels={["Tại quầy", "Online"]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Doanh thu {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <EmptyState
              size="compact"
              icon={ReceiptText}
              title="Chưa có đơn nào"
              description={`Không có đơn bán nào trong ${periodLabel}.`}
            />
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
          <CardTitle>Top {TOP_PRODUCTS_LIMIT} bán chạy</CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <EmptyState
              size="compact"
              icon={TrendingUp}
              title="Chưa có hàng bán chạy"
              description="Bán vài đơn là danh sách sẽ tự hiện."
            />
          ) : (
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sắp hết hàng</CardTitle>
        </CardHeader>
        <CardContent>
          {lowStock.length === 0 ? (
            <EmptyState
              size="compact"
              icon={PackageCheck}
              title="Không có hàng nào sắp hết"
            />
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

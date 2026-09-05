import { Money, PageHeader, StatTile } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDailyRevenue,
  getLowStockProducts,
  getTopProducts,
} from "@/server/reports/daily-revenue";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [revenue, topProducts, lowStock] = await Promise.all([
    getDailyRevenue(14),
    getTopProducts(10),
    getLowStockProducts(5),
  ]);

  // Con so tong cua ca ky — chu quan nhin cai la thay, khong phai cong nham.
  const totalRevenue = revenue.reduce((sum, row) => sum + row.revenue, 0);
  const totalOrders = revenue.reduce((sum, row) => sum + row.orderCount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo cáo"
        description="Doanh thu và hàng bán chạy, xem nhanh tình hình cửa hàng."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile
          label="Doanh thu"
          value={totalRevenue}
          format="money"
          hint="14 ngày gần nhất"
        />
        <StatTile label="Số đơn" value={totalOrders} hint="14 ngày gần nhất" />
        <StatTile label="Sắp hết hàng" value={lowStock.length} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Doanh thu 14 ngày gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="text-muted-foreground">Chưa có đơn nào</p>
          ) : (
            <ul className="divide-y">
              {revenue.map((row) => (
                <li key={row.date} className="flex justify-between py-2">
                  <span>
                    {row.date}
                    <span className="text-muted-foreground ml-2 text-sm">
                      {row.orderCount} đơn
                    </span>
                  </span>
                  <span className="font-semibold tabular-nums">
                    <Money amount={row.revenue} />
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

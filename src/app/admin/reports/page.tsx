import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVnd } from "@/lib/money";
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Báo cáo</h1>

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
                    {formatVnd(row.revenue)}
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

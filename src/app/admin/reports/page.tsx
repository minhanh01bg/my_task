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
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Báo cáo</h1>

      <section>
        <h2 className="mb-2 font-medium">Doanh thu 14 ngày gần nhất</h2>
        {revenue.length === 0 ? (
          <p className="text-muted-foreground">Chưa có đơn nào</p>
        ) : (
          <ul className="divide-y">
            {revenue.map((row) => (
              <li key={row.date} className="flex justify-between py-2">
                <span>
                  {row.date}
                  <span className="ml-2 text-sm text-muted-foreground">
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
      </section>

      <section>
        <h2 className="mb-2 font-medium">Hàng bán chạy</h2>
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
      </section>

      <section>
        <h2 className="mb-2 font-medium">Sắp hết hàng</h2>
        {lowStock.length === 0 ? (
          <p className="text-muted-foreground">Không có hàng nào sắp hết</p>
        ) : (
          <ul className="divide-y">
            {lowStock.map((row) => (
              <li key={row.id} className="flex justify-between py-2">
                <span>{row.name}</span>
                <span className={row.stock < 0 ? "text-red-600" : undefined}>
                  {row.stock} {row.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

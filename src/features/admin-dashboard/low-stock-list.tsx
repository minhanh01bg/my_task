import Link from "next/link";
import { PackageCheck, Pencil } from "lucide-react";

import { EmptyState, StockBadge } from "@/components/kit";
import type { LowStockRow } from "@/server/reports/daily-revenue";

import { DashboardListCard } from "./dashboard-list-card";

export function LowStockList({ products }: { products: LowStockRow[] }) {
  return (
    <DashboardListCard
      id="dashboard-low-stock"
      title="Hàng tồn thấp"
      viewAllHref="/admin/products?status=low"
      viewAllLabel="hàng sắp hết"
    >
      {products.length === 0 ? (
        <EmptyState
          size="compact"
          icon={PackageCheck}
          title="Không có hàng nào sắp hết"
          description="Kho đang đủ hàng cho mọi mặt hàng."
        />
      ) : (
        <ul className="divide-y">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0 truncate font-medium">
                {product.name}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <StockBadge stock={product.stock} unit={product.unit} />
                <Link
                  href={`/admin/products?edit=${encodeURIComponent(product.id)}`}
                  aria-label={`Sửa nhanh ${product.name}`}
                  className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Pencil aria-hidden="true" className="size-5" />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardListCard>
  );
}

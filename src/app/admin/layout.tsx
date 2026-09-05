import Link from "next/link";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  CreditCard,
  Package,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";

const NAV = [
  { href: "/pos", label: "Về quầy bán hàng", icon: ShoppingCart },
  { href: "/admin/products", label: "Sản phẩm", icon: Package },
  { href: "/admin/categories", label: "Danh mục", icon: Boxes },
  { href: "/admin/orders", label: "Đơn hàng", icon: ClipboardList },
  { href: "/admin/debts", label: "Công nợ", icon: CreditCard },
  { href: "/admin/reports", label: "Báo cáo", icon: BarChart3 },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-[250px_minmax(0,1fr)]">
      <nav
        aria-label="Điều hướng quản lý"
        className="bg-card border-b p-3 md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0 md:p-5"
      >
        <div className="mb-4 hidden items-center gap-3 px-2 md:flex">
          <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Store aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="font-heading font-bold">An Phát POS</p>
            <p className="text-muted-foreground text-xs">Trung tâm quản lý</p>
          </div>
        </div>
        <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1 md:overflow-visible">
          {NAV.map((item) => (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className="hover:bg-accent focus-visible:ring-ring flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none"
              >
                <item.icon aria-hidden="true" className="size-4 shrink-0" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

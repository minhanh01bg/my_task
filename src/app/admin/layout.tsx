import Link from "next/link";

const NAV = [
  { href: "/pos", label: "← Bán hàng" },
  { href: "/admin/products", label: "Sản phẩm" },
  { href: "/admin/categories", label: "Danh mục" },
  { href: "/admin/orders", label: "Đơn hàng" },
  { href: "/admin/debts", label: "Công nợ" },
  { href: "/admin/reports", label: "Báo cáo" },
  { href: "/admin/settings", label: "Cài đặt" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 grid min-h-dvh grid-cols-[220px_1fr]">
      <nav className="bg-background border-r p-4">
        <p className="text-muted-foreground mb-4 px-3 text-xs font-semibold tracking-wide uppercase">
          Quản lý
        </p>
        <ul className="flex flex-col gap-1">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="hover:bg-accent block rounded-lg px-3 py-2 text-sm"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}

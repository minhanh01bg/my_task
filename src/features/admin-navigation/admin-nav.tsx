"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartBar,
  CreditCard,
  Gear,
  Package,
  ShoppingCart,
  SquaresFour,
  Storefront,
  TextAlignLeft,
} from "@phosphor-icons/react";

const NAV = [
  { href: "/pos", label: "Về quầy bán hàng", icon: ShoppingCart },
  { href: "/admin/products", label: "Sản phẩm", icon: Package },
  { href: "/admin/categories", label: "Danh mục", icon: SquaresFour },
  { href: "/admin/orders", label: "Đơn hàng", icon: TextAlignLeft },
  { href: "/admin/debts", label: "Công nợ", icon: CreditCard },
  { href: "/admin/reports", label: "Báo cáo", icon: ChartBar },
  { href: "/admin/settings", label: "Cài đặt", icon: Gear },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Điều hướng quản lý"
      className="bg-card/85 border-b p-3 backdrop-blur-xl md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0 md:p-5"
    >
      <div className="mb-5 hidden items-center gap-3 px-2 md:flex">
        <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-2xl shadow-md">
          <Storefront aria-hidden="true" weight="fill" className="size-5" />
        </span>
        <div>
          <p className="font-heading font-bold">Quản lý cửa hàng</p>
          <p className="text-muted-foreground text-xs">Dễ nhìn · dễ thao tác</p>
        </div>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:gap-1.5 md:overflow-visible">
        {NAV.map((item) => {
          const active =
            item.href === "/pos"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="hover:bg-accent/12 focus-visible:ring-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:ring-3 focus-visible:outline-none aria-[current=page]:shadow-[0_8px_20px_-12px_oklch(0.3_0.1_150/0.7)]"
              >
                <item.icon
                  aria-hidden="true"
                  weight={active ? "fill" : "regular"}
                  className="size-5 shrink-0"
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

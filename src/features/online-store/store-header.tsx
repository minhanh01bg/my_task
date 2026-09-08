"use client";

import Link from "next/link";
import { LayoutDashboard, ShoppingBag, UserRound } from "lucide-react";

import { useOnlineCart } from "./cart-context";
import { CartDrawer } from "./cart-drawer";

export function StoreHeader({
  storeName,
  isAdmin = false,
}: {
  storeName: string;
  isAdmin?: boolean;
}) {
  const { lines, hydrated, openDrawer } = useOnlineCart();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/shop" className="font-heading text-xl font-bold">
            {storeName}
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Link
                href="/admin/orders"
                aria-label="Quay lại trang quản trị"
                className="border-border inline-flex min-h-11 items-center rounded-xl border px-3 font-bold"
              >
                <LayoutDashboard aria-hidden="true" className="size-5" />
                <span className="ml-2 hidden sm:inline">Quản trị</span>
              </Link>
            ) : null}
            <Link
              href="/account/orders"
              aria-label="Tài khoản khách hàng"
              className="border-border inline-flex min-h-11 items-center rounded-xl border px-3 font-bold"
            >
              <UserRound aria-hidden="true" className="size-5" />
              <span className="ml-2 hidden sm:inline">Tài khoản</span>
            </Link>
            <button
              type="button"
              onClick={openDrawer}
              aria-label={`Mở giỏ hàng, hiện có ${hydrated ? count : 0} sản phẩm`}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold transition-colors outline-none focus-visible:ring-2"
            >
              <ShoppingBag aria-hidden="true" className="size-5" />
              <span>Giỏ hàng</span>
              <span
                aria-hidden="true"
                className="bg-background text-foreground rounded-full px-2 py-0.5 text-xs font-semibold"
              >
                {hydrated ? count : 0}
              </span>
            </button>
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}

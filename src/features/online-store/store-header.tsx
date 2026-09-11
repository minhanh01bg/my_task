"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, ShoppingBag, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerNotificationButton } from "@/features/customer-notifications/notification-button";
import { cn } from "@/lib/utils";

import { useOnlineCart } from "./cart-context";
import { CartDrawer } from "./cart-drawer";

export function StoreHeader({
  storeName,
  isAdmin = false,
  isCustomer = false,
}: {
  storeName: string;
  isAdmin?: boolean;
  isCustomer?: boolean;
}) {
  const { lines, hydrated, openDrawer } = useOnlineCart();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  const [isBouncing, setIsBouncing] = useState(false);
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (count > prevCountRef.current) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 400);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = count;
  }, [count]);

  return (
    <>
      <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/shop" className="font-heading text-xl font-bold">
            {storeName}
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button
                variant="outline"
                className="min-h-11 font-bold"
                nativeButton={false}
                aria-label="Quay lại trang quản trị"
                render={<Link href="/admin/orders" />}
              >
                <LayoutDashboard aria-hidden="true" className="size-5" />
                <span className="ml-1.5 hidden sm:inline">Quản trị</span>
              </Button>
            ) : (
              <>
                {isCustomer ? <CustomerNotificationButton /> : null}
                <Button
                  variant="outline"
                  className="min-h-11 font-bold"
                  nativeButton={false}
                  aria-label="Tài khoản khách hàng"
                  render={<Link href="/account/orders" />}
                >
                  <UserRound aria-hidden="true" className="size-5" />
                  <span className="ml-1.5 hidden sm:inline">Tài khoản</span>
                </Button>
              </>
            )}
            <ThemeToggle />
            <Button
              type="button"
              onClick={openDrawer}
              aria-label={`Mở giỏ hàng, hiện có ${hydrated ? count : 0} sản phẩm`}
              className="min-h-11 font-bold"
            >
              <ShoppingBag aria-hidden="true" className="size-5" />
              <span>Giỏ hàng</span>
              <Badge
                variant="secondary"
                className={cn(
                  "ml-1 px-1.5 py-0 text-xs font-bold transition-transform",
                  isBouncing &&
                    "animate-badge-bounce bg-primary text-primary-foreground",
                )}
              >
                {hydrated ? count : 0}
              </Badge>
            </Button>
          </div>
        </div>
      </header>
      <CartDrawer />
    </>
  );
}

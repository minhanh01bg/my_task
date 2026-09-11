"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, LayoutDashboard, ShoppingBag, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerNotificationButton } from "@/features/customer-notifications/notification-button";
import { useWishlist } from "@/lib/storage/wishlist";
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
  const { count: wishlistCount } = useWishlist();
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
      <header className="border-border bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/shop"
            className="font-heading text-foreground hover:text-primary text-xl font-bold tracking-tight transition-colors"
          >
            {storeName}
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Button
                variant="outline"
                className="min-h-11 font-bold"
                nativeButton={false}
                aria-label="Về trang quản trị"
                render={<Link href="/admin/products" />}
              >
                <LayoutDashboard aria-hidden="true" className="size-5" />
                <span className="ml-1.5 hidden sm:inline">Quản trị</span>
              </Button>
            ) : (
              <>
                <CustomerNotificationButton />
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
            <Link
              href="/shop?wishlist=true"
              aria-label={`Danh sách yêu thích (${wishlistCount} sản phẩm)`}
              className="border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted relative inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors"
            >
              <Heart
                aria-hidden="true"
                className={cn(
                  "size-5 transition-colors",
                  wishlistCount > 0 && "fill-rose-500 text-rose-500",
                )}
              />
              {wishlistCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[0.65rem] font-bold text-white shadow-sm">
                  {wishlistCount}
                </span>
              ) : null}
            </Link>
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

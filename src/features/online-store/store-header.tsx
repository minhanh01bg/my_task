"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { useOnlineCart } from "./cart-context";

export function StoreHeader({ storeName }: { storeName: string }) {
  const { lines, hydrated } = useOnlineCart();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/shop" className="font-heading text-xl font-bold">
          {storeName}
        </Link>
        <Link
          href="/checkout"
          className="bg-primary text-primary-foreground inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-bold"
        >
          <ShoppingBag aria-hidden="true" className="size-5" /> Giỏ hàng
          <span
            aria-label={`${hydrated ? count : 0} sản phẩm`}
            className="bg-background text-foreground rounded-full px-2 py-0.5 text-xs"
          >
            {hydrated ? count : 0}
          </span>
        </Link>
      </div>
    </header>
  );
}

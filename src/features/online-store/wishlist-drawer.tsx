"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, HeartOff, ShoppingCart, X } from "lucide-react";

import { EmptyState } from "@/components/kit/empty-state";
import { Skeleton } from "@/components/kit/skeleton-loader";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatVnd } from "@/lib/money";
import { productHref } from "@/lib/seo/product-href";
import { useWishlist } from "@/lib/storage/wishlist";

import { useOnlineCart } from "./cart-context";
import type { OnlineProduct } from "./types";

const WISHLIST_URL = "/api/online/wishlist";

interface WishlistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchWishlistProducts(ids: string[]): Promise<OnlineProduct[]> {
  const response = await fetch(
    `${WISHLIST_URL}?ids=${encodeURIComponent(ids.join(","))}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("wishlist_fetch_failed");
  const body = (await response.json()) as {
    data?: { products?: OnlineProduct[] };
  };
  return body.data?.products ?? [];
}

/**
 * Ngan "Yêu thích" (Sheet phai). Danh sach id nam o may khach
 * (`useWishlist`); thong tin san pham tai tu API khi mo ngan.
 */
export function WishlistDrawer({ open, onOpenChange }: WishlistDrawerProps) {
  const { items, toggle } = useWishlist();
  const { add } = useOnlineCart();
  const [loaded, setLoaded] = useState<Map<string, OnlineProduct>>(
    () => new Map(),
  );
  /** Id da hoi server (ke ca id khong con ban) — tranh goi lai lien tuc. */
  const [requested, setRequested] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [failed, setFailed] = useState(false);

  const missing = useMemo(
    () => items.filter((id) => !requested.has(id)),
    [items, requested],
  );
  const loading = open && missing.length > 0 && !failed;

  useEffect(() => {
    if (!open || missing.length === 0 || failed) return;
    let cancelled = false;
    fetchWishlistProducts(missing)
      .then((products) => {
        if (cancelled) return;
        setLoaded((current) => {
          const next = new Map(current);
          for (const product of products) next.set(product.id, product);
          return next;
        });
        setRequested((current) => new Set([...current, ...missing]));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, missing, failed]);

  const products = items.flatMap((id) => {
    const product = loaded.get(id);
    return product ? [product] : [];
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setFailed(false);
        onOpenChange(next);
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="bg-background gap-0"
      >
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <Heart aria-hidden="true" className="text-primary size-5" />
            <SheetTitle className="font-sans text-lg font-bold">
              Sản phẩm yêu thích
            </SheetTitle>
            {items.length > 0 ? (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                {items.length}
              </span>
            ) : null}
          </div>
          <SheetClose
            aria-label="Đóng danh sách yêu thích"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-11 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2"
          >
            <X aria-hidden="true" className="size-5" />
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          Các sản phẩm bạn đã lưu, có thể thêm nhanh vào giỏ hàng.
        </SheetDescription>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Chưa có sản phẩm yêu thích"
              description="Bấm biểu tượng trái tim trên sản phẩm để lưu lại xem sau."
            />
          ) : failed && products.length === 0 ? (
            <div role="alert" className="space-y-3 text-center text-sm">
              <p className="text-destructive font-medium">
                Không tải được danh sách yêu thích.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFailed(false)}
              >
                Thử lại
              </Button>
            </div>
          ) : (
            <ul className="divide-border divide-y" aria-busy={loading}>
              {products.map((product) => {
                const outOfStock = product.stock <= 0;
                return (
                  <li
                    key={product.id}
                    className="flex gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-xl">
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      ) : (
                        <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                          Ảnh
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={productHref(product)}
                            onClick={() => onOpenChange(false)}
                            className="hover:text-primary line-clamp-2 font-bold transition-colors"
                          >
                            {product.name}
                          </Link>
                          <p className="text-muted-foreground text-xs">
                            {formatVnd(product.price)} ₫ /{product.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggle(product.id)}
                          aria-label={`Bỏ ${product.name} khỏi danh sách yêu thích`}
                          className="text-muted-foreground hover:text-destructive inline-flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors"
                        >
                          <HeartOff aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={outOfStock}
                        onClick={() => add(product)}
                        aria-label={
                          outOfStock
                            ? `${product.name} đã hết hàng`
                            : `Thêm ${product.name} vào giỏ`
                        }
                        className="min-h-10 w-full font-bold"
                      >
                        <ShoppingCart aria-hidden="true" className="size-4" />
                        {outOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                      </Button>
                    </div>
                  </li>
                );
              })}
              {loading
                ? Array.from(
                    { length: Math.min(missing.length, 3) },
                    (_, index) => (
                      <li
                        key={`skeleton-${index}`}
                        className="flex gap-4 py-4 first:pt-0"
                      >
                        <Skeleton className="size-20 shrink-0 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/3" />
                          <Skeleton className="h-10 w-full rounded-xl" />
                        </div>
                      </li>
                    ),
                  )
                : null}
            </ul>
          )}
          {loading ? (
            <p role="status" className="sr-only">
              Đang tải danh sách yêu thích…
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

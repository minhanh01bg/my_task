"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, ShoppingCart, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import {
  clearRecentlyViewed,
  getRecentlyViewed,
  type RecentlyViewedItem,
} from "@/lib/storage/recently-viewed";

import { useOnlineCart } from "./cart-context";

function subscribe(callback: () => void) {
  window.addEventListener("recently_viewed_updated", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("recently_viewed_updated", callback);
    window.removeEventListener("storage", callback);
  };
}

let cachedRaw = "";
let cachedItems: RecentlyViewedItem[] = [];

function getSnapshot(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("pos_store_recently_viewed") || "[]";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedItems = getRecentlyViewed();
  }
  return cachedItems;
}

function getServerSnapshot(): RecentlyViewedItem[] {
  return [];
}

export function RecentlyViewedSection() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { add } = useOnlineCart();

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="surface-panel rounded-3xl p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
              <Clock className="size-5" />
            </div>
            <h2 className="font-heading text-foreground text-xl font-bold tracking-tight sm:text-2xl">
              Sản phẩm bạn vừa xem
            </h2>
          </div>

          <button
            type="button"
            onClick={clearRecentlyViewed}
            className="text-muted-foreground hover:text-destructive flex items-center gap-1.5 text-xs font-semibold transition-colors"
            aria-label="Xóa lịch sử xem"
          >
            <Trash2 className="size-3.5" />
            <span>Xóa lịch sử</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="card-interactive border-border bg-card group flex flex-col justify-between overflow-hidden rounded-2xl border p-3 shadow-xs"
            >
              <div>
                <div className="bg-muted relative aspect-square overflow-hidden rounded-xl">
                  <Link
                    href={`/shop/products/${item.id}`}
                    className="block h-full w-full"
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                        Chưa có ảnh
                      </div>
                    )}
                  </Link>
                </div>

                <div className="mt-2.5">
                  <Link
                    href={`/shop/products/${item.id}`}
                    className="hover:text-primary transition-colors"
                  >
                    <h3 className="text-foreground line-clamp-1 text-xs font-bold sm:text-sm">
                      {item.name}
                    </h3>
                  </Link>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-primary font-mono text-sm font-bold">
                      {formatVnd(item.price)}
                    </span>
                    <span className="text-muted-foreground text-[0.7rem]">
                      /{item.unit}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    add({
                      id: item.id,
                      name: item.name,
                      price: item.price,
                      unit: item.unit,
                      stock: item.stock,
                      imageUrl: item.imageUrl ?? null,
                      categoryId: item.categoryId ?? null,
                      searchText: item.name.toLowerCase(),
                    })
                  }
                  className="btn-press hover:bg-primary hover:text-primary-foreground w-full gap-1 rounded-xl text-xs font-semibold shadow-2xs"
                >
                  <ShoppingCart className="size-3.5" />
                  <span>Mua lại</span>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

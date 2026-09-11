"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flame, ShoppingCart } from "lucide-react";

import { CountdownTimer } from "@/components/kit/countdown-timer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";

import { useOnlineCart } from "../cart-context";
import type { OnlineProduct } from "../types";

export interface FlashSaleSectionProps {
  products: OnlineProduct[];
  title?: string;
  targetDate?: Date | string | number;
}

export function FlashSaleSection({
  products,
  title = "GIỜ VÀNG FLASH SALE",
  targetDate,
}: FlashSaleSectionProps) {
  const { add } = useOnlineCart();

  // Target: end of day today if not provided
  const endOfDay = useMemo(() => {
    if (targetDate) return targetDate;
    const now = new Date();
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );
    return end;
  }, [targetDate]);

  const displayProducts = products.filter((p) => p.stock > 0).slice(0, 4);

  if (displayProducts.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="surface-panel relative overflow-hidden rounded-3xl border-red-500/20 bg-gradient-to-r from-red-500/5 via-amber-500/5 to-transparent p-6 sm:p-8">
        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -top-12 -left-12 size-64 rounded-full bg-red-500/10 blur-3xl" />

        {/* Section Header */}
        <div className="relative z-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-red-500/15 text-red-600 shadow-xs dark:text-red-400">
              <Flame className="animate-pulse-subtle size-7 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-foreground text-xl font-extrabold tracking-tight sm:text-2xl">
                  {title}
                </h2>
                <Badge
                  variant="destructive"
                  className="animate-pulse-subtle rounded-full text-xs font-bold uppercase"
                >
                  Hot Deal
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Số lượng có hạn • Giá sốc trong khung giờ vàng
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden text-xs font-semibold sm:inline-block">
              Kết thúc sau:
            </span>
            <CountdownTimer targetDate={endOfDay} />
          </div>
        </div>

        {/* Flash Sale Product Grid */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayProducts.map((product, index) => {
            // Simulated discount percent between 15% and 30%
            const discountPercent =
              15 + ((index * 7 + product.name.length) % 15);
            const originalPrice =
              Math.round((product.price * (1 + discountPercent / 100)) / 1000) *
              1000;
            const soldPercent = Math.min(
              95,
              Math.max(35, 40 + ((index * 13 + product.name.length) % 50)),
            );

            return (
              <article
                key={product.id}
                className="card-interactive border-border/80 bg-card/95 group flex flex-col justify-between overflow-hidden rounded-2xl border p-3 shadow-xs hover:border-red-500/40"
              >
                <div>
                  {/* Image & Discount Badge */}
                  <div className="bg-muted relative aspect-square overflow-hidden rounded-xl">
                    <div className="absolute top-2 left-2 z-10">
                      <Badge className="bg-red-600 text-xs font-bold text-white shadow-xs">
                        -{discountPercent}%
                      </Badge>
                    </div>

                    <Link
                      href={`/shop/products/${product.id}`}
                      className="block h-full w-full"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
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

                  {/* Title and Prices */}
                  <div className="mt-3">
                    <Link
                      href={`/shop/products/${product.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      <h3 className="text-foreground line-clamp-2 min-h-10 text-xs font-bold sm:text-sm">
                        {product.name}
                      </h3>
                    </Link>

                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="font-mono text-sm font-extrabold text-red-600 sm:text-base dark:text-red-400">
                        {formatVnd(product.price)}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs line-through">
                        {formatVnd(originalPrice)}
                      </span>
                    </div>

                    {/* Sales Progress Bar */}
                    <div className="mt-2.5">
                      <div className="bg-muted h-3.5 w-full overflow-hidden rounded-full p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-500"
                          style={{ width: `${soldPercent}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground mt-1 block text-[0.65rem] font-semibold">
                        🔥 Đã bán {soldPercent}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Add to Cart CTA */}
                <div className="mt-3 pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => add(product)}
                    className="btn-press w-full gap-1.5 rounded-xl bg-red-600 text-xs font-bold text-white shadow-xs hover:bg-red-700 sm:text-sm"
                  >
                    <ShoppingCart className="size-3.5" />
                    <span>Mua ngay</span>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

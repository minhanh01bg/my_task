"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";

import { useOnlineCart } from "../cart-context";
import type { OnlineProduct } from "../types";

export interface ProductRailProps {
  title?: string;
  subtitle?: string;
  products: OnlineProduct[];
}

export function ProductRail({
  title = "Sản phẩm nổi bật",
  subtitle = "Lựa chọn được khách hàng quan tâm nhiều nhất",
  products,
}: ProductRailProps) {
  const { add } = useOnlineCart();
  const displayProducts = products.slice(0, 8);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
          ) : null}
        </div>
        <Link
          href="#catalog"
          className="text-primary hidden items-center gap-1 text-sm font-semibold hover:underline sm:inline-flex"
        >
          <span>Xem tất cả</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {displayProducts.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {displayProducts.map((product) => {
            const isOutOfStock = product.stock <= 0;
            return (
              <article
                key={product.id}
                className="border-border bg-card group flex flex-col justify-between overflow-hidden rounded-2xl border transition-all hover:shadow-md"
              >
                <div>
                  <div className="bg-muted relative aspect-square overflow-hidden">
                    {isOutOfStock ? (
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <Badge
                          variant="destructive"
                          className="font-bold shadow-xs"
                        >
                          Hết hàng
                        </Badge>
                      </div>
                    ) : null}
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
                        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                          Chưa có ảnh
                        </div>
                      )}
                    </Link>
                  </div>

                  <div className="p-4 pb-2">
                    <Link
                      href={`/shop/products/${product.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      <h3 className="text-foreground line-clamp-2 min-h-10 text-sm font-bold sm:text-base">
                        {product.name}
                      </h3>
                    </Link>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-primary text-base font-bold sm:text-lg">
                        {formatVnd(product.price)} ₫
                      </span>
                      <span className="text-muted-foreground text-xs">
                        /{product.unit}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isOutOfStock}
                    onClick={() => add(product)}
                    aria-label={
                      !isOutOfStock
                        ? `Thêm ${product.name} vào giỏ hàng`
                        : `${product.name} đã hết hàng`
                    }
                    className="hover:bg-primary hover:text-primary-foreground mt-2 w-full font-bold transition-colors"
                  >
                    <ShoppingCart
                      className="mr-1.5 size-4"
                      aria-hidden="true"
                    />
                    <span>{isOutOfStock ? "Tạm hết" : "Thêm vào giỏ"}</span>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="border-border bg-muted/20 text-muted-foreground mt-6 rounded-2xl border border-dashed p-8 text-center text-sm">
          Chưa có sản phẩm nổi bật, sản phẩm sẽ sớm được cập nhật.
        </div>
      )}
    </section>
  );
}

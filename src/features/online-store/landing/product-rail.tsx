import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { formatVnd } from "@/lib/money";

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
          {displayProducts.map((product) => (
            <article
              key={product.id}
              className="border-border bg-card group overflow-hidden rounded-2xl border transition-all hover:shadow-sm"
            >
              <div className="bg-muted relative aspect-square overflow-hidden">
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
              </div>

              <div className="p-4">
                <h3 className="text-foreground line-clamp-2 min-h-10 text-sm font-bold">
                  {product.name}
                </h3>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-primary text-base font-bold sm:text-lg">
                    {formatVnd(product.price)} ₫
                  </span>
                  <span className="text-muted-foreground text-xs">
                    /{product.unit}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-border bg-muted/20 text-muted-foreground mt-6 rounded-2xl border border-dashed p-8 text-center text-sm">
          Chưa có sản phẩm nổi bật, sản phẩm sẽ sớm được cập nhật.
        </div>
      )}
    </section>
  );
}

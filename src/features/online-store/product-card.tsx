"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, ShoppingCart } from "lucide-react";

import { Money } from "@/components/kit/money";
import { WishlistButton } from "@/components/kit/wishlist-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { productHref } from "@/lib/seo/product-href";

import { useOnlineCart } from "./cart-context";
import type { OnlineProduct } from "./types";

/**
 * Thẻ sản phẩm của lưới catalog: dùng ở /shop (CatalogBrowser) và trang danh
 * mục /shop/c/[slug]. Cần nằm trong OnlineCartProvider.
 * `onQuickView` có thì hiện nút "Xem nhanh" (hover/focus trên màn hình lớn).
 */
export function ProductCard({
  product,
  onQuickView,
}: {
  product: OnlineProduct;
  onQuickView?: (product: OnlineProduct) => void;
}) {
  const { add } = useOnlineCart();

  return (
    <article className="card-interactive border-border bg-card group overflow-hidden rounded-2xl border shadow-xs">
      <div className="bg-muted relative aspect-square overflow-hidden">
        <div className="absolute top-2.5 left-2.5 z-10">
          <WishlistButton
            productId={product.id}
            productName={product.name}
            size="sm"
          />
        </div>
        {product.stock <= 0 ? (
          <div className="absolute top-2.5 right-2.5 z-10">
            <Badge variant="destructive" className="font-bold shadow-xs">
              Hết hàng
            </Badge>
          </div>
        ) : null}
        {onQuickView ? (
          <button
            type="button"
            onClick={() => onQuickView(product)}
            aria-label={`Xem nhanh ${product.name}`}
            className="bg-background/90 text-foreground border-border hover:bg-primary hover:text-primary-foreground focus-visible:ring-ring absolute bottom-2.5 left-1/2 z-10 inline-flex min-h-10 -translate-x-1/2 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold shadow-sm backdrop-blur-sm transition-opacity focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:outline-none sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
          >
            <Eye aria-hidden="true" className="size-4" />
            Xem nhanh
          </button>
        ) : null}
        <Link
          href={productHref(product)}
          className="relative block h-full w-full"
          tabIndex={-1}
          aria-hidden="true"
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Chưa có ảnh
            </div>
          )}
        </Link>
      </div>
      <div className="p-4">
        <Link
          href={productHref(product)}
          className="hover:text-primary transition-colors"
        >
          <h3 className="line-clamp-2 min-h-12 font-bold">{product.name}</h3>
        </Link>
        <p className="text-muted-foreground mt-1 text-sm">/{product.unit}</p>
        <div className="text-primary mt-2 text-lg font-bold">
          <Money amount={product.price} />
        </div>
        <Button
          type="button"
          disabled={product.stock <= 0}
          onClick={() => add(product)}
          aria-label={
            product.stock > 0
              ? `Thêm ${product.name} vào giỏ`
              : `${product.name} đã hết hàng`
          }
          className="mt-4 min-h-11 w-full font-bold"
        >
          <ShoppingCart aria-hidden="true" className="size-4" />
          {product.stock > 0 ? "Thêm vào giỏ" : "Hết hàng"}
        </Button>
      </div>
    </article>
  );
}

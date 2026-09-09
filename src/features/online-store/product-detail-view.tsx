"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/kit/money";
import { StockBadge } from "@/components/kit/stock-badge";
import { formatVnd } from "@/lib/money";
import type { OnlineProductDetail } from "@/server/catalog/get-product-detail";

import { useOnlineCart } from "./cart-context";
import { CartFeedback } from "./cart-feedback";

export function ProductDetailView({ detail }: { detail: OnlineProductDetail }) {
  const { product, relatedProducts } = detail;
  const { add, openDrawer } = useOnlineCart();
  const router = useRouter();

  const [quantity, setQuantity] = useState(1);
  const isOutOfStock = product.stock <= 0;
  const maxAllowed = Math.max(1, Math.floor(product.stock));

  const handleIncrement = () => {
    setQuantity((prev) => Math.min(maxAllowed, prev + 1));
  };

  const handleDecrement = () => {
    setQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    add(product, quantity);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    add(product, quantity);
    router.push("/checkout");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <CartFeedback />

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground mb-6 flex items-center gap-2 text-xs font-medium sm:text-sm"
      >
        <Link
          href="/shop"
          className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Cửa hàng</span>
        </Link>
        <ChevronRight className="text-muted-foreground/50 size-3.5" />
        {product.category ? (
          <>
            <Link
              href={`/shop?category=${encodeURIComponent(product.category.id)}#catalog`}
              className="hover:text-foreground transition-colors"
            >
              {product.category.name}
            </Link>
            <ChevronRight className="text-muted-foreground/50 size-3.5" />
          </>
        ) : null}
        <span
          className="text-foreground truncate font-semibold"
          aria-current="page"
        >
          {product.name}
        </span>
      </nav>

      {/* Product Details Section */}
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        {/* Left: Product Image */}
        <div className="border-border bg-card relative aspect-square overflow-hidden rounded-3xl border shadow-sm">
          {isOutOfStock ? (
            <div className="absolute top-4 right-4 z-10">
              <Badge
                variant="destructive"
                className="px-3 py-1 text-sm font-bold shadow-sm"
              >
                Tạm hết hàng
              </Badge>
            </div>
          ) : null}
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              priority
              className="object-cover transition-transform duration-500 hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2">
              <Package className="size-16 opacity-30" />
              <p className="text-sm font-medium">Chưa có ảnh sản phẩm</p>
            </div>
          )}
        </div>

        {/* Right: Product Info & Actions */}
        <div className="flex flex-col justify-between">
          <div>
            {product.category ? (
              <span className="bg-primary/10 text-primary inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase">
                {product.category.name}
              </span>
            ) : null}

            <h1 className="font-heading text-foreground mt-3 text-2xl font-extrabold sm:text-3xl lg:text-4xl">
              {product.name}
            </h1>

            {product.sku ? (
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                Mã SP:{" "}
                <span className="font-mono font-medium">{product.sku}</span>
              </p>
            ) : null}

            {/* Price Card */}
            <div className="border-border bg-muted/30 mt-6 rounded-2xl border p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-primary font-heading text-3xl font-extrabold sm:text-4xl">
                  {formatVnd(product.price)} ₫
                </span>
                <span className="text-muted-foreground text-sm font-medium">
                  /{product.unit}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <StockBadge stock={product.stock} unit={product.unit} />
                {product.stock > 0 && product.stock <= 10 ? (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Chỉ còn {product.stock} {product.unit} trong kho
                  </span>
                ) : null}
              </div>
            </div>

            {/* Quantity Stepper */}
            {!isOutOfStock ? (
              <div className="mt-6">
                <label
                  htmlFor="product-quantity-stepper"
                  className="text-foreground block text-sm font-bold"
                >
                  Số lượng
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="border-border bg-card flex items-center rounded-xl border shadow-xs">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      disabled={quantity <= 1}
                      aria-label="Giảm số lượng"
                      className="text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-l-xl transition-colors disabled:opacity-40"
                    >
                      <Minus className="size-4" />
                    </button>
                    <input
                      id="product-quantity-stepper"
                      type="number"
                      min={1}
                      max={maxAllowed}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!Number.isNaN(val)) {
                          setQuantity(Math.max(1, Math.min(maxAllowed, val)));
                        }
                      }}
                      className="h-11 w-16 [appearance:textfield] text-center font-bold outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={handleIncrement}
                      disabled={quantity >= maxAllowed}
                      aria-label="Tăng số lượng"
                      className="text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-r-xl transition-colors disabled:opacity-40"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Tối đa {maxAllowed} {product.unit}
                  </span>
                </div>
              </div>
            ) : null}

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                size="lg"
                disabled={isOutOfStock}
                onClick={handleAddToCart}
                className="min-h-12 flex-1 gap-2 rounded-xl text-base font-bold shadow-sm"
              >
                <ShoppingCart className="size-5" />
                <span>
                  {isOutOfStock ? "Tạm hết hàng" : "Thêm vào giỏ hàng"}
                </span>
              </Button>

              {!isOutOfStock ? (
                <Button
                  type="button"
                  size="lg"
                  variant="secondary"
                  onClick={handleBuyNow}
                  className="min-h-12 flex-1 gap-2 rounded-xl text-base font-bold"
                >
                  <ShoppingBag className="size-5" />
                  <span>Mua ngay</span>
                </Button>
              ) : null}
            </div>
          </div>

          {/* Reassurance Trust Signals */}
          <div className="border-border bg-card/60 mt-8 space-y-3 rounded-2xl border p-4 text-xs sm:text-sm">
            <div className="text-muted-foreground flex items-center gap-2.5">
              <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Sản phẩm chính hãng, nguồn gốc xuất xứ rõ ràng</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2.5">
              <Truck className="text-primary size-4 shrink-0" />
              <span>Giao hàng tận nơi hoặc nhận trực tiếp tại cửa hàng</span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2.5">
              <CheckCircle2 className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <span>Được kiểm tra hàng trước khi thanh toán</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Rail */}
      {relatedProducts.length > 0 ? (
        <section className="mt-16 border-t pt-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-2xl font-bold">
                Sản phẩm cùng danh mục
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Có thể bạn cũng quan tâm những mặt hàng này
              </p>
            </div>
            {product.categoryId ? (
              <Link
                href={`/shop?category=${encodeURIComponent(product.categoryId)}#catalog`}
                className="text-primary text-sm font-semibold hover:underline"
              >
                Xem thêm
              </Link>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((rel) => (
              <article
                key={rel.id}
                className="border-border bg-card group flex flex-col justify-between overflow-hidden rounded-2xl border transition-all hover:shadow-md"
              >
                <div>
                  <div className="bg-muted relative aspect-square overflow-hidden">
                    <Link
                      href={`/shop/products/${rel.id}`}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="block h-full w-full"
                    >
                      {rel.imageUrl ? (
                        <Image
                          src={rel.imageUrl}
                          alt={rel.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                          Chưa có ảnh
                        </div>
                      )}
                    </Link>
                  </div>
                  <div className="p-4 pb-2">
                    <Link
                      href={`/shop/products/${rel.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      <h3 className="line-clamp-2 min-h-10 text-sm font-bold sm:text-base">
                        {rel.name}
                      </h3>
                    </Link>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-primary text-base font-bold sm:text-lg">
                        {formatVnd(rel.price)} ₫
                      </span>
                      <span className="text-muted-foreground text-xs">
                        /{rel.unit}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={rel.stock <= 0}
                    onClick={() => add(rel)}
                    aria-label={`Thêm ${rel.name} vào giỏ hàng`}
                    className="hover:bg-primary hover:text-primary-foreground mt-2 w-full font-bold transition-colors"
                  >
                    <ShoppingCart className="mr-1.5 size-4" />
                    <span>{rel.stock <= 0 ? "Hết hàng" : "Thêm vào giỏ"}</span>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

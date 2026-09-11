"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, X } from "lucide-react";

import { StockBadge } from "@/components/kit/stock-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";

import { useOnlineCart } from "./cart-context";
import type { OnlineProduct } from "./types";

export interface QuickViewModalProps {
  product: OnlineProduct | null;
  onClose: () => void;
}

export function QuickViewModal({ product, onClose }: QuickViewModalProps) {
  const { add } = useOnlineCart();
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!product) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const isOutOfStock = product.stock <= 0;
  const maxQuantity = Math.max(1, Math.floor(product.stock));

  const handleIncrement = () => {
    setQuantity((q) => Math.min(maxQuantity, q + 1));
  };

  const handleDecrement = () => {
    setQuantity((q) => Math.max(1, q - 1));
  };

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    add(product, quantity);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-view-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Container */}
      <div className="surface-panel bg-background relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-2xl sm:flex-row">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng xem nhanh"
          className="text-muted-foreground hover:text-foreground bg-background/80 absolute top-4 right-4 z-20 flex size-9 items-center justify-center rounded-full backdrop-blur-sm transition-colors outline-none focus-visible:ring-2"
        >
          <X className="size-5" />
        </button>

        {/* Product Image Section */}
        <div className="bg-muted relative aspect-square w-full sm:w-1/2">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 320px"
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm font-medium">
              Chưa có hình ảnh
            </div>
          )}
          {isOutOfStock ? (
            <div className="absolute top-3 left-3 z-10">
              <Badge variant="destructive" className="font-bold shadow-xs">
                Tạm hết hàng
              </Badge>
            </div>
          ) : null}
        </div>

        {/* Product Details Section */}
        <div className="flex w-full flex-col justify-between p-6 sm:w-1/2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Đơn vị tính: {product.unit}
              </span>
            </div>

            <h2
              id="quick-view-title"
              className="font-heading text-foreground mt-2 text-xl font-bold tracking-tight sm:text-2xl"
            >
              {product.name}
            </h2>

            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-primary font-mono text-2xl font-extrabold">
                {formatVnd(product.price)}
              </span>
              <span className="text-muted-foreground text-xs">
                /{product.unit}
              </span>
            </div>

            <div className="mt-3">
              <StockBadge stock={product.stock} unit={product.unit} />
            </div>

            {/* Quantity Selector */}
            {!isOutOfStock ? (
              <div className="mt-6">
                <label className="text-muted-foreground block text-xs font-semibold">
                  Số lượng mua:
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <div className="border-border bg-card inline-flex items-center rounded-xl border p-1 shadow-xs">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      disabled={quantity <= 1}
                      aria-label="Giảm số lượng"
                      className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span
                      aria-label="Số lượng mua"
                      className="min-w-10 text-center font-mono text-sm font-bold"
                    >
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={handleIncrement}
                      disabled={quantity >= maxQuantity}
                      aria-label="Tăng số lượng"
                      className="text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 items-center justify-center rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    (Tổng: {formatVnd(product.price * quantity)})
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Action Buttons */}
          <div className="mt-6 space-y-3 pt-2">
            <Button
              type="button"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="btn-press w-full gap-2 rounded-xl py-5 text-base font-bold shadow-md"
            >
              <ShoppingBag className="size-5" />
              <span>{isOutOfStock ? "Hết hàng" : "Thêm vào giỏ"}</span>
            </Button>

            <Link
              href={`/shop/products/${product.id}`}
              className="text-primary hover:text-primary/80 inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold hover:underline"
            >
              <span>Xem trang chi tiết đầy đủ</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

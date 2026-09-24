"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, X } from "lucide-react";

import { StockBadge } from "@/components/kit/stock-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatVnd } from "@/lib/money";
import { productHref } from "@/lib/seo/product-href";

import { useOnlineCart } from "./cart-context";
import type { OnlineProduct } from "./types";

export interface QuickViewModalProps {
  product: OnlineProduct | null;
  onClose: () => void;
}

/**
 * Base UI Dialog lo focus trap, khoa cuon, Escape va tra focus ve nut mo.
 */
export function QuickViewModal({ product, onClose }: QuickViewModalProps) {
  const { add } = useOnlineCart();
  const [quantity, setQuantity] = useState(1);
  // Giu san pham cuoi cung de noi dung con nguyen trong luc hop thoai dong.
  const [shown, setShown] = useState<OnlineProduct | null>(product);
  if (product && product !== shown) {
    setShown(product);
    setQuantity(1);
  }

  const current = product ?? shown;
  const isOutOfStock = (current?.stock ?? 0) <= 0;
  const maxQuantity = Math.max(1, Math.floor(current?.stock ?? 1));

  const handleIncrement = () => {
    setQuantity((q) => Math.min(maxQuantity, q + 1));
  };

  const handleDecrement = () => {
    setQuantity((q) => Math.max(1, q - 1));
  };

  const handleAddToCart = () => {
    if (isOutOfStock || !current) return;
    add(current, quantity);
    onClose();
  };

  return (
    <Dialog
      open={product !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="surface-panel bg-background flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl sm:max-w-2xl sm:flex-row"
      >
        {current ? (
          <>
            <DialogClose
              aria-label="Đóng xem nhanh"
              className="text-muted-foreground hover:text-foreground bg-background/80 focus-visible:ring-ring absolute top-4 right-4 z-20 flex size-11 items-center justify-center rounded-full backdrop-blur-sm transition-colors outline-none focus-visible:ring-2"
            >
              <X aria-hidden="true" className="size-5" />
            </DialogClose>

            {/* Product Image Section */}
            <div className="bg-muted relative aspect-square w-full sm:w-1/2">
              {current.imageUrl ? (
                <Image
                  src={current.imageUrl}
                  alt={current.name}
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
                    Đơn vị tính: {current.unit}
                  </span>
                </div>

                <DialogTitle className="font-heading text-foreground mt-2 text-xl leading-tight font-bold tracking-tight sm:text-2xl">
                  {current.name}
                </DialogTitle>

                <div className="mt-3 flex items-baseline gap-3">
                  <span className="text-primary font-mono text-2xl font-extrabold">
                    {formatVnd(current.price)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    /{current.unit}
                  </span>
                </div>

                <div className="mt-3">
                  <StockBadge stock={current.stock} unit={current.unit} />
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
                          <Minus aria-hidden="true" className="size-4" />
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
                          <Plus aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        (Tổng: {formatVnd(current.price * quantity)})
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
                  <ShoppingBag aria-hidden="true" className="size-5" />
                  <span>{isOutOfStock ? "Hết hàng" : "Thêm vào giỏ"}</span>
                </Button>

                <Link
                  href={productHref(current)}
                  className="text-primary hover:text-primary/80 inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold hover:underline"
                >
                  <span>Xem trang chi tiết đầy đủ</span>
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Minus,
  PackageX,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import { formatVnd } from "@/lib/money";

import { useOnlineCart } from "./cart-context";

const FREE_SHIPPING_THRESHOLD = 200_000;

export function CartDrawer() {
  const { lines, isDrawerOpen, closeDrawer, setQuantity, remove } =
    useOnlineCart();

  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isDrawerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDrawer();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDrawerOpen, closeDrawer]);

  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [lines],
  );

  const totalItems = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  if (!isDrawerOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        aria-hidden="true"
        className="animate-fade-in fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-over sheet */}
      <div
        ref={drawerRef}
        className="border-border bg-background animate-slide-in-right relative z-10 flex h-full w-full max-w-md flex-col border-l shadow-2xl transition-transform"
      >
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <ShoppingBag aria-hidden="true" className="text-primary size-5" />
            <h2 id="cart-drawer-title" className="text-lg font-bold">
              Giỏ hàng của bạn
            </h2>
            {lines.length > 0 && (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                {totalItems}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Đóng giỏ hàng"
            className="text-muted-foreground hover:text-foreground inline-flex size-9 items-center justify-center rounded-xl transition-colors outline-none focus-visible:ring-2"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        {/* Free Shipping Progress Bar */}
        {lines.length > 0 && (
          <div className="border-border bg-muted/30 border-b px-6 py-3.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              {subtotal >= FREE_SHIPPING_THRESHOLD ? (
                <span className="text-success flex items-center gap-1.5 font-bold">
                  <Truck className="size-4" />
                  <span>🎉 Chúc mừng! Bạn đã được Miễn phí giao hàng!</span>
                </span>
              ) : (
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Truck className="text-primary size-4" />
                  <span>
                    Mua thêm{" "}
                    <strong className="text-foreground font-bold">
                      {formatVnd(FREE_SHIPPING_THRESHOLD - subtotal)} ₫
                    </strong>{" "}
                    để được Miễn phí giao hàng
                  </span>
                </span>
              )}
            </div>
            <div
              data-testid="free-shipping-bar"
              className="bg-muted mt-2 h-2 w-full overflow-hidden rounded-full"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  subtotal >= FREE_SHIPPING_THRESHOLD
                    ? "bg-success"
                    : "bg-primary"
                }`}
                style={{
                  width: `${Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <PackageX
                aria-hidden="true"
                className="text-muted-foreground/60 size-16"
              />
              <p className="mt-4 text-base font-bold">
                Giỏ hàng của bạn đang trống
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Hãy dạo một vòng cửa hàng để chọn những món đồ bạn yêu thích
                nhé!
              </p>
              <button
                type="button"
                onClick={closeDrawer}
                className="bg-primary text-primary-foreground hover:bg-primary/90 mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 font-bold transition-colors"
              >
                Tiếp tục mua sắm
              </button>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {lines.map((line) => {
                const lineTotal = line.price * line.quantity;
                const isMaxStock = line.quantity >= line.stock;
                const isMinQuantity = line.quantity <= 1;

                return (
                  <li
                    key={line.id}
                    className="flex gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-xl">
                      {line.imageUrl ? (
                        <Image
                          src={line.imageUrl}
                          alt={line.name}
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

                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="line-clamp-1 font-bold">
                            {line.name}
                          </h3>
                          <p className="text-muted-foreground text-xs">
                            {formatVnd(line.price)} ₫ /{line.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(line.id)}
                          aria-label={`Xóa ${line.name} khỏi giỏ hàng`}
                          className="text-muted-foreground hover:text-destructive inline-flex size-7 items-center justify-center rounded-lg transition-colors"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        {/* Stepper */}
                        <div className="border-border bg-background flex items-center rounded-lg border">
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(line.id, line.quantity - 1)
                            }
                            disabled={isMinQuantity}
                            aria-label={`Giảm số lượng ${line.name}`}
                            className="text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-l-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Minus aria-hidden="true" className="size-3.5" />
                          </button>
                          <span
                            data-testid={`quantity-${line.id}`}
                            className="w-8 text-center text-xs font-bold"
                          >
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setQuantity(line.id, line.quantity + 1)
                            }
                            disabled={isMaxStock}
                            aria-label={`Tăng số lượng ${line.name}`}
                            className="text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-r-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Plus aria-hidden="true" className="size-3.5" />
                          </button>
                        </div>

                        {/* Line Total */}
                        <span className="font-bold">
                          {formatVnd(lineTotal)} ₫
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && (
          <div className="border-border bg-muted/30 border-t p-6">
            <div className="flex items-center justify-between text-base font-bold">
              <span>Tạm tính</span>
              <span
                data-testid="cart-subtotal"
                className="text-primary text-xl"
              >
                {formatVnd(subtotal)} ₫
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Giá và tồn kho sẽ được xác nhận lại khi bạn đặt hàng.
            </p>
            <div className="mt-4">
              <Link
                href="/checkout"
                onClick={closeDrawer}
                className="bg-primary text-primary-foreground hover:bg-primary/90 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-bold shadow-md transition-all active:scale-[0.98]"
              >
                <ShoppingBag aria-hidden="true" className="size-5" />
                Tiến hành đặt hàng
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

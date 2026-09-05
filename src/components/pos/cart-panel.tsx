"use client";

import { useMemo } from "react";
import { ArrowRight, ShoppingCart } from "lucide-react";

import { CartLineRow } from "@/components/pos/cart-line-row";
import { calculateCart } from "@/lib/pricing/calculate";
import { useCartStore } from "@/stores/cart-store";
import { Money, TouchButton } from "@/components/kit";

interface CartPanelProps {
  onCheckout: () => void;
}

export function CartPanel({ onCheckout }: CartPanelProps) {
  const lines = useCartStore((state) => state.lines);
  const orderDiscount = useCartStore((state) => state.orderDiscount);

  const totals = useMemo(
    () => calculateCart(lines, orderDiscount),
    [lines, orderDiscount],
  );

  return (
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <ShoppingCart aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-bold">Đơn hiện tại</h2>
            <p className="text-muted-foreground text-sm">
              {lines.length} mặt hàng
            </p>
          </div>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <span className="bg-muted flex size-16 items-center justify-center rounded-full">
            <ShoppingCart aria-hidden="true" className="size-7" />
          </span>
          <p className="text-foreground font-bold">Chưa có sản phẩm nào</p>
          <p className="max-w-60 text-sm">
            Tìm sản phẩm hoặc chọn theo danh mục bên trái để thêm vào đơn.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto py-2">
          {totals.lines.map((line) => (
            <CartLineRow key={line.id} line={line} lineTotal={line.lineTotal} />
          ))}
        </ul>
      )}

      <div className="border-t pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground font-semibold">
            Khách cần trả
          </span>
          <span
            data-testid="cart-total"
            className="font-heading text-3xl font-bold tracking-tight tabular-nums"
          >
            <Money amount={totals.total} className="text-3xl" />
          </span>
        </div>

        <TouchButton
          size="lg"
          disabled={lines.length === 0}
          onClick={onCheckout}
          className="mt-4 h-16 w-full justify-between px-5 text-lg"
        >
          Thanh toán (F4)
        </TouchButton>
      </div>
    </section>
  );
}

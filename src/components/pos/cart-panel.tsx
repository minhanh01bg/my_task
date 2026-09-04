"use client";

import { useMemo } from "react";

import { CartLineRow } from "@/components/pos/cart-line-row";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { calculateCart } from "@/lib/pricing/calculate";
import { useCartStore } from "@/stores/cart-store";

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
      <h2 className="border-b pb-3 text-xl font-semibold">Giỏ hàng</h2>

      {lines.length === 0 ? (
        <p className="text-muted-foreground flex flex-1 items-center justify-center">
          Chưa có sản phẩm nào
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {totals.lines.map((line) => (
            <CartLineRow key={line.id} line={line} lineTotal={line.lineTotal} />
          ))}
        </ul>
      )}

      <div className="border-t pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg">Tổng cộng</span>
          <span
            data-testid="cart-total"
            className="text-4xl font-bold tabular-nums"
          >
            {formatVnd(totals.total)}
          </span>
        </div>

        <Button
          size="lg"
          disabled={lines.length === 0}
          onClick={onCheckout}
          className="mt-4 h-16 w-full text-xl"
        >
          Thanh toán (F4)
        </Button>
      </div>
    </section>
  );
}

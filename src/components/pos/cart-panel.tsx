"use client";

import { useMemo } from "react";
import { ArrowRight, Basket } from "@phosphor-icons/react";

import { CartLineRow } from "@/components/pos/cart-line-row";
import { ConfirmAction } from "@/components/shared/confirm-action";
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
  const clear = useCartStore((state) => state.clear);

  const totals = useMemo(
    () => calculateCart(lines, orderDiscount),
    [lines, orderDiscount],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Basket aria-hidden="true" weight="duotone" className="size-6" />
          </span>
          <div>
            <h2 className="font-heading text-xl font-bold">Đơn hiện tại</h2>
            <p className="text-muted-foreground text-sm">
              {lines.length} mặt hàng
            </p>
          </div>
        </div>
        {lines.length > 0 ? (
          <ConfirmAction
            action={async () => clear()}
            triggerLabel="Xóa cả đơn"
            title="Xóa toàn bộ đơn hiện tại?"
            description={`Đơn đang có ${lines.length} mặt hàng, tổng cộng ${formatVnd(totals.total)}. Chỉ xóa khi bạn chắc chắn không tiếp tục bán đơn này.`}
            confirmLabel="Xóa toàn bộ đơn"
            triggerVariant="ghost"
            triggerClassName="text-destructive min-h-11 shrink-0"
          />
        ) : null}
      </div>

      {lines.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <span className="bg-muted flex size-16 items-center justify-center rounded-full">
            <Basket aria-hidden="true" weight="duotone" className="size-8" />
          </span>
          <p className="text-foreground font-bold">Chưa có sản phẩm nào</p>
          <p className="max-w-60 text-sm">
            Tìm sản phẩm hoặc chọn theo danh mục bên trái để thêm vào đơn.
          </p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2 pr-1 [scrollbar-gutter:stable]">
          {totals.lines.map((line) => (
            <CartLineRow key={line.id} line={line} lineTotal={line.lineTotal} />
          ))}
        </ul>
      )}

      <div className="bg-card shrink-0 border-t pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground font-semibold">
            Khách cần trả
          </span>
          <span
            data-testid="cart-total"
            className="font-heading text-3xl font-bold tracking-tight tabular-nums"
          >
            {formatVnd(totals.total)}
          </span>
        </div>

        <Button
          size="lg"
          disabled={lines.length === 0}
          onClick={onCheckout}
          className="mt-4 h-16 w-full justify-between px-5 text-lg"
        >
          <span>
            Thanh toán <span className="hidden opacity-75 sm:inline">(F4)</span>
          </span>
          <ArrowRight aria-hidden="true" weight="bold" className="size-5" />
        </Button>
      </div>
    </section>
  );
}

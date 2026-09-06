"use client";

import { Minus, Plus, Trash } from "@phosphor-icons/react";

import { Input } from "@/components/ui/input";
import type { CartLine } from "@/lib/pricing/types";
import { useCartStore } from "@/stores/cart-store";
import { Money } from "@/components/kit";

const PRICE_STEP = 1000;
const stepperButtonClass =
  "hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center transition-[color,background-color] focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none";
const stepperClass =
  "border-input bg-background flex h-11 min-w-0 overflow-hidden rounded-xl border shadow-xs";
const stepperInputClass =
  "h-full min-w-0 flex-1 appearance-none rounded-none border-0 bg-transparent px-1 text-center text-base font-bold tabular-nums shadow-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

interface CartLineRowProps {
  line: CartLine;
  lineTotal: number;
}

export function CartLineRow({ line, lineTotal }: CartLineRowProps) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const updateUnitPrice = useCartStore((state) => state.updateUnitPrice);
  const removeLine = useCartStore((state) => state.removeLine);

  return (
    <li className="flex flex-col gap-2 border-b py-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-lg font-medium">
          {line.name}
        </span>
        <span className="shrink-0 pt-1 text-lg font-semibold tabular-nums">
          <Money amount={lineTotal} />
        </span>
        <button
          type="button"
          aria-label={`Xoá dòng ${line.name}`}
          onClick={() => removeLine(line.id)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring -mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div
        data-testid="cart-line-controls"
        className="grid min-w-0 grid-cols-1 gap-2 min-[380px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
      >
        <div className="min-w-0 space-y-1">
          <span className="text-muted-foreground block truncate text-xs font-semibold">
            Số lượng · {line.unit}
          </span>
          <div className={stepperClass}>
            <button
              type="button"
              aria-label={`Bớt một ${line.unit} ${line.name}`}
              onClick={() =>
                updateQuantity(line.id, Math.max(0, line.quantity - 1))
              }
              className={`${stepperButtonClass} border-border border-r`}
            >
              <Minus aria-hidden="true" weight="bold" className="size-4" />
            </button>
            <Input
              aria-label={`Số lượng ${line.name}`}
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={line.quantity}
              onChange={(event) =>
                updateQuantity(line.id, Number(event.target.value) || 0)
              }
              className={stepperInputClass}
            />
            <button
              type="button"
              aria-label={`Thêm một ${line.unit} ${line.name}`}
              onClick={() => updateQuantity(line.id, line.quantity + 1)}
              className={`${stepperButtonClass} border-border text-primary border-l`}
            >
              <Plus aria-hidden="true" weight="bold" className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <span className="text-muted-foreground block text-xs font-semibold">
            Đơn giá · bước 1.000đ
          </span>
          <div className={stepperClass}>
            <button
              type="button"
              aria-label={`Giảm đơn giá ${line.name} 1.000 đồng`}
              onClick={() =>
                updateUnitPrice(
                  line.id,
                  Math.max(0, line.unitPrice - PRICE_STEP),
                )
              }
              className={`${stepperButtonClass} border-border border-r`}
            >
              <Minus aria-hidden="true" weight="bold" className="size-4" />
            </button>
            <Input
              aria-label={`Đơn giá ${line.name}`}
              type="number"
              inputMode="numeric"
              step={PRICE_STEP}
              min="0"
              value={line.unitPrice}
              onChange={(event) =>
                updateUnitPrice(
                  line.id,
                  Math.max(0, Math.round(Number(event.target.value) || 0)),
                )
              }
              className={stepperInputClass}
            />
            <button
              type="button"
              aria-label={`Tăng đơn giá ${line.name} 1.000 đồng`}
              onClick={() =>
                updateUnitPrice(line.id, line.unitPrice + PRICE_STEP)
              }
              className={`${stepperButtonClass} border-border text-primary border-l`}
            >
              <Plus aria-hidden="true" weight="bold" className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

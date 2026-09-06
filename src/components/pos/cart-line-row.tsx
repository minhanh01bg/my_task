"use client";

import { Minus, Plus, Trash } from "@phosphor-icons/react";

import { Input } from "@/components/ui/input";
import type { CartLine } from "@/lib/pricing/types";
import { useCartStore } from "@/stores/cart-store";
import { Money } from "@/components/kit";

const PRICE_STEP = 1000;
const stepperButtonClass =
  "hover:bg-card focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-[0.65rem] transition-[color,background-color,transform] focus-visible:ring-2 focus-visible:outline-none active:scale-95";

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
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-medium">{line.name}</span>
        <button
          type="button"
          aria-label={`Xoá dòng ${line.name}`}
          onClick={() => removeLine(line.id)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring flex size-11 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Trash aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="border-border bg-muted/45 flex h-12 items-center rounded-xl border p-0.5 shadow-inner">
          <button
            type="button"
            aria-label={`Bớt một ${line.unit} ${line.name}`}
            onClick={() =>
              updateQuantity(line.id, Math.max(0, line.quantity - 1))
            }
            className={stepperButtonClass}
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
            className="h-11 w-16 appearance-none rounded-none border-0 bg-transparent px-1 text-center text-base font-bold tabular-nums shadow-none focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label={`Thêm một ${line.unit} ${line.name}`}
            onClick={() => updateQuantity(line.id, line.quantity + 1)}
            className={`${stepperButtonClass} bg-card text-primary hover:bg-primary hover:text-primary-foreground shadow-sm`}
          >
            <Plus aria-hidden="true" weight="bold" className="size-4" />
          </button>
        </div>
        <span className="text-muted-foreground text-sm">{line.unit}</span>

        <span className="text-muted-foreground">×</span>

        <div className="border-border bg-muted/45 flex h-12 items-center rounded-xl border p-0.5 shadow-inner">
          <button
            type="button"
            aria-label={`Giảm đơn giá ${line.name} 1.000 đồng`}
            onClick={() =>
              updateUnitPrice(line.id, Math.max(0, line.unitPrice - PRICE_STEP))
            }
            className={stepperButtonClass}
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
            className="h-11 w-24 appearance-none rounded-none border-0 bg-transparent px-1 text-center text-base font-bold tabular-nums shadow-none focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            aria-label={`Tăng đơn giá ${line.name} 1.000 đồng`}
            onClick={() =>
              updateUnitPrice(line.id, line.unitPrice + PRICE_STEP)
            }
            className={`${stepperButtonClass} bg-card text-primary hover:bg-primary hover:text-primary-foreground shadow-sm`}
          >
            <Plus aria-hidden="true" weight="bold" className="size-4" />
          </button>
        </div>

        <span className="ml-auto text-lg font-semibold tabular-nums">
          <Money amount={lineTotal} />
        </span>
      </div>
    </li>
  );
}

"use client";

import { Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { formatVnd } from "@/lib/money";
import type { CartLine } from "@/lib/pricing/types";
import { useCartStore } from "@/stores/cart-store";

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
          className="text-muted-foreground hover:bg-accent rounded p-2"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Input
          aria-label={`Số lượng ${line.name}`}
          type="number"
          step="any"
          min="0"
          value={line.quantity}
          onChange={(event) =>
            updateQuantity(line.id, Number(event.target.value) || 0)
          }
          className="h-9 w-20 text-right tabular-nums"
        />
        <span className="text-muted-foreground text-sm">{line.unit}</span>

        <span className="text-muted-foreground">×</span>

        <Input
          aria-label={`Đơn giá ${line.name}`}
          type="number"
          step="1"
          min="0"
          value={line.unitPrice}
          onChange={(event) =>
            updateUnitPrice(
              line.id,
              Math.round(Number(event.target.value) || 0),
            )
          }
          className="h-9 w-28 text-right tabular-nums"
        />

        <span className="ml-auto text-lg font-semibold tabular-nums">
          {formatVnd(lineTotal)}
        </span>
      </div>
    </li>
  );
}

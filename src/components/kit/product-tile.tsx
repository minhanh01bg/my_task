"use client";

import { Money } from "@/components/kit/money";
import { ProductImage } from "@/components/kit/product-image";
import { StockBadge } from "@/components/kit/stock-badge";
import { cn } from "@/lib/utils";

interface ProductTileProps {
  name: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string | null;
  onSelect: () => void;
  className?: string;
}

/**
 * min-h co dinh la co y: luoi hang hoa ten dai ngan khac nhau, khong ep
 * chieu cao thi cac the so le nhin rat lon xon.
 */
export function ProductTile({
  name,
  price,
  unit,
  stock,
  imageUrl,
  onSelect,
  className,
}: ProductTileProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "bg-card border-border hover:border-primary hover:bg-accent flex min-h-36 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none",
        className,
      )}
    >
      <ProductImage src={imageUrl} name={name} size={48} />
      <span className="line-clamp-2 flex-1 font-medium">{name}</span>
      <div className="flex w-full items-center justify-between gap-2">
        <Money amount={price} />
        <StockBadge stock={stock} unit={unit} />
      </div>
    </button>
  );
}

"use client";

import { Eye } from "lucide-react";

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
  /** Co thi hien nut "Xem nhanh" khi hover/focus (luon hien tren dien thoai). */
  onQuickView?: () => void;
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
  onQuickView,
  className,
}: ProductTileProps) {
  const tile = (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "card-interactive btn-press bg-card border-border hover:border-primary hover:bg-accent flex min-h-36 flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
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

  if (!onQuickView) return tile;

  // Nut xem nhanh nam CANH the (khong long button trong button).
  return (
    <div className="group relative">
      {tile}
      <button
        type="button"
        onClick={onQuickView}
        aria-label={`Xem nhanh ${name}`}
        className="bg-background/90 text-foreground border-border hover:bg-primary hover:text-primary-foreground focus-visible:ring-ring absolute top-2 right-2 inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-bold shadow-xs backdrop-blur-sm transition-opacity focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:outline-none sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
      >
        <Eye aria-hidden="true" className="size-3.5" />
        Xem nhanh
      </button>
    </div>
  );
}

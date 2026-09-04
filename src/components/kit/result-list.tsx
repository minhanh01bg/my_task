"use client";

import { Money } from "@/components/kit/money";
import { ProductImage } from "@/components/kit/product-image";
import { StockBadge } from "@/components/kit/stock-badge";
import { cn } from "@/lib/utils";

interface ResultListProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
}

/** Khung co vien + divide-y de danh sach khong troi lan vao nen. */
export function ResultList({ id, children, className }: ResultListProps) {
  return (
    <ul
      id={id}
      role="listbox"
      className={cn(
        "border-border bg-card divide-border divide-y overflow-hidden rounded-xl border",
        className,
      )}
    >
      {children}
    </ul>
  );
}

interface ResultRowProps {
  name: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string | null;
  active: boolean;
  onSelect: () => void;
}

/**
 * Go rat nhanh ca ngay — dong dang chon phai khac han, nen dung ca nen dam
 * lan mot thanh nhan ben trai, khong chi doi mau nen mot chut.
 */
export function ResultRow({
  name,
  price,
  unit,
  stock,
  imageUrl,
  active,
  onSelect,
}: ResultRowProps) {
  return (
    <li
      role="option"
      aria-selected={active}
      className={cn(
        "border-l-4",
        active ? "border-l-primary bg-accent" : "border-l-transparent",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-h-touch hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <ProductImage src={imageUrl} name={name} size={40} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-lg font-medium">{name}</span>
          <StockBadge stock={stock} unit={unit} className="w-fit" />
        </span>
        <Money amount={price} className="text-lg" />
      </button>
    </li>
  );
}

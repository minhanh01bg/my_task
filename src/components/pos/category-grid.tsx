"use client";

import { formatVnd } from "@/lib/money";
import type { SearchableProduct } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import type { CatalogCategory } from "@/types/catalog";

interface CategoryGridProps {
  categories: CatalogCategory[];
  products: SearchableProduct[];
  activeCategoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  onSelect: (product: SearchableProduct) => void;
}

/** Duong bo tro cho go tim — bam chon khi khong nho ten hang. */
export function CategoryGrid({
  categories,
  products,
  activeCategoryId,
  onCategoryChange,
  onSelect,
}: CategoryGridProps) {
  const visible = activeCategoryId
    ? products.filter((product) => product.categoryId === activeCategoryId)
    : [];

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap"
        aria-label="Danh mục sản phẩm"
      >
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() =>
              onCategoryChange(
                activeCategoryId === category.id ? null : category.id,
              )
            }
            className={cn(
              "focus-visible:ring-ring min-h-11 shrink-0 cursor-pointer rounded-xl border px-4 py-2 text-base font-bold transition-colors focus-visible:ring-3 focus-visible:outline-none",
              activeCategoryId === category.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-accent",
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {activeCategoryId === null ? (
        <p className="bg-muted/60 text-muted-foreground rounded-xl px-4 py-5 text-center text-sm">
          Chọn một danh mục ở trên để xem các sản phẩm bên trong.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {visible.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product)}
            className="bg-card border-border hover:border-primary/40 hover:bg-accent focus-visible:ring-ring flex min-h-24 cursor-pointer flex-col items-start justify-between rounded-xl border p-4 text-left transition-colors focus-visible:ring-3 focus-visible:outline-none"
          >
            <span className="line-clamp-2 font-medium">{product.name}</span>
            <span className="mt-1 font-semibold tabular-nums">
              {formatVnd(product.price)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

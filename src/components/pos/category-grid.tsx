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
      <div className="flex flex-wrap gap-2">
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
              "rounded-full px-4 py-2 text-base",
              activeCategoryId === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-accent",
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {visible.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product)}
            className="bg-card ring-foreground/10 hover:bg-accent flex flex-col items-start rounded-xl p-3 text-left ring-1 transition-colors"
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

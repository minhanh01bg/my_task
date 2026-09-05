"use client";

import { ChipToggle, ProductTile } from "@/components/kit";
import type { SearchableProduct } from "@/lib/search/types";
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
          <ChipToggle
            key={category.id}
            label={category.name}
            selected={activeCategoryId === category.id}
            onToggle={() =>
              onCategoryChange(
                activeCategoryId === category.id ? null : category.id,
              )
            }
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map((product) => (
          <ProductTile
            key={product.id}
            name={product.name}
            price={product.price}
            unit={product.unit}
            stock={product.stock}
            imageUrl={product.imageUrl}
            onSelect={() => onSelect(product)}
          />
        ))}
      </div>
    </div>
  );
}

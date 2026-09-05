"use client";

import { useMemo, useRef, useState } from "react";
import { MagnifyingGlass, MagnifyingGlassMinus } from "@phosphor-icons/react";

import { Input } from "@/components/ui/input";
import { ProductImage } from "@/components/shared/product-image";
import { formatVnd } from "@/lib/money";
import { searchProducts } from "@/lib/search/match";
import type { SearchableProduct } from "@/lib/search/types";
import { cn } from "@/lib/utils";

interface ProductSearchProps {
  products: SearchableProduct[];
  onSelect: (product: SearchableProduct) => void;
}

const RESULT_LIMIT = 20;

/**
 * O tim kiem la duong vao chinh cua moi giao dich — cua hang chua co barcode.
 * Tim kiem chay hoan toan trong bo nho nen khong co do tre mang.
 */
export function ProductSearch({ products, onSelect }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => searchProducts(products, query, RESULT_LIMIT),
    [products, query],
  );

  function reset() {
    setQuery("");
    setActiveIndex(0);
  }

  function choose(product: SearchableProduct) {
    onSelect(product);
    reset();
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const picked = results[activeIndex];
      if (picked) choose(picked);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      reset();
    }
  }

  const showEmpty = query.trim().length > 0 && results.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor="product-search"
        className="font-heading text-base font-bold"
      >
        Bạn muốn bán sản phẩm nào?
      </label>
      <div className="relative">
        <MagnifyingGlass
          aria-hidden="true"
          weight="bold"
          className="text-primary pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2"
        />
        <Input
          id="product-search"
          ref={inputRef}
          role="combobox"
          aria-expanded={query.trim().length > 0 && results.length > 0}
          aria-controls="pos-search-results"
          aria-autocomplete="list"
          value={query}
          autoFocus
          placeholder="Nhập tên, mã hoặc loại sản phẩm..."
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="h-14 rounded-xl pr-4 pl-12 text-lg shadow-none"
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md border px-2 py-1 text-xs sm:block">
          F2
        </span>
      </div>

      {showEmpty ? (
        <p
          className="text-muted-foreground flex flex-col items-center gap-2 px-4 py-7 text-center"
          role="status"
        >
          <MagnifyingGlassMinus
            aria-hidden="true"
            weight="duotone"
            className="size-8"
          />
          Không tìm thấy sản phẩm. Thử nhập tên ngắn hơn.
        </p>
      ) : null}

      <ul
        id="pos-search-results"
        role="listbox"
        className="flex max-h-72 flex-col gap-1 overflow-y-auto"
      >
        {results.map((product, index) => (
          <li key={product.id}>
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => choose(product)}
              className={cn(
                "focus-visible:ring-ring flex min-h-14 w-full cursor-pointer items-center justify-between rounded-xl px-4 py-3 text-left text-lg transition-colors focus-visible:ring-2 focus-visible:outline-none",
                index === activeIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-muted",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <ProductImage
                  src={product.imageUrl}
                  alt={`Ảnh ${product.name}`}
                  className="size-12"
                />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{product.name}</span>
                  <span className="text-muted-foreground text-sm">
                    Còn {product.stock} {product.unit}
                  </span>
                </span>
              </span>
              <span className="font-semibold tabular-nums">
                {formatVnd(product.price)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

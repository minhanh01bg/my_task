"use client";

import { useMemo, useRef, useState } from "react";

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
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls="pos-search-results"
        value={query}
        autoFocus
        placeholder="Tìm sản phẩm... (F2)"
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border px-4 py-4 text-xl outline-none focus:ring-2"
      />

      {showEmpty ? (
        <p className="text-muted-foreground px-4 py-6 text-center">
          Không tìm thấy sản phẩm nào
        </p>
      ) : null}

      <ul
        id="pos-search-results"
        role="listbox"
        className="flex flex-col gap-1"
      >
        {results.map((product, index) => (
          <li key={product.id}>
            <button
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onClick={() => choose(product)}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-lg",
                index === activeIndex ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <span className="flex flex-col">
                <span className="font-medium">{product.name}</span>
                <span className="text-muted-foreground text-sm">
                  Còn {product.stock} {product.unit}
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

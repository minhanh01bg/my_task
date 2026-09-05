"use client";

import { useMemo, useRef, useState } from "react";
import { Search, SearchX } from "lucide-react";

import {
  EmptyState,
  ResultList,
  ResultRow,
  SearchField,
} from "@/components/kit";
import { searchProducts } from "@/lib/search/match";
import type { SearchableProduct } from "@/lib/search/types";

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
    <div className="flex flex-col gap-3">
      <SearchField
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
        onClear={reset}
      />

      {showEmpty ? (
        <EmptyState
          title="Không tìm thấy sản phẩm nào"
          description="Thử gõ ít chữ hơn, hoặc chọn theo danh mục bên dưới."
        />
      ) : null}

      {results.length > 0 ? (
        <ResultList id="pos-search-results">
          {results.map((product, index) => (
            <ResultRow
              key={product.id}
              name={product.name}
              price={product.price}
              unit={product.unit}
              stock={product.stock}
              imageUrl={product.imageUrl}
              active={index === activeIndex}
              onSelect={() => choose(product)}
            />
          ))}
        </ResultList>
      ) : null}
    </div>
  );
}

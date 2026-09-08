"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpDown, RotateCcw, Search, X } from "lucide-react";

import { formatVnd } from "@/lib/money";
import type { CatalogFilter, CatalogSort } from "@/types/storefront";

import { useOnlineCart } from "./cart-context";
import type { OnlineCategory } from "./types";

interface CatalogFiltersProps {
  categories: OnlineCategory[];
  filter: CatalogFilter;
  onFilterChange: (newFilter: CatalogFilter) => void;
  resultCount: number;
}

export function CatalogFilters({
  categories,
  filter,
  onFilterChange,
  resultCount,
}: CatalogFiltersProps) {
  const { hydrated } = useOnlineCart();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const searchInputId = useId();
  const sortSelectId = useId();
  const inStockCheckboxId = useId();

  // Đồng bộ filter state lên URL searchParams
  const syncToUrl = (updated: CatalogFilter) => {
    const params = new URLSearchParams();
    if (updated.q) params.set("q", updated.q);
    if (updated.category) params.set("category", updated.category);
    if (updated.inStock) params.set("inStock", "true");
    if (updated.minPrice !== null)
      params.set("minPrice", String(updated.minPrice));
    if (updated.maxPrice !== null)
      params.set("maxPrice", String(updated.maxPrice));
    if (updated.sort && updated.sort !== "relevance")
      params.set("sort", updated.sort);

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", targetUrl);
    }
    startTransition(() => {
      router.replace(targetUrl, { scroll: false });
    });
  };

  const handleUpdate = (partial: Partial<CatalogFilter>) => {
    const next: CatalogFilter = { ...filter, ...partial };
    onFilterChange(next);
    syncToUrl(next);
  };

  const handleClearAll = () => {
    const cleared: CatalogFilter = {
      q: "",
      category: null,
      inStock: false,
      minPrice: null,
      maxPrice: null,
      sort: "relevance",
    };
    onFilterChange(cleared);
    syncToUrl(cleared);
  };

  const activeCategory = categories.find((c) => c.id === filter.category);
  const hasActiveFilters =
    Boolean(filter.q) ||
    Boolean(filter.category) ||
    filter.inStock ||
    filter.minPrice !== null ||
    filter.maxPrice !== null ||
    filter.sort !== "relevance";

  return (
    <div className="space-y-4">
      {/* Search and Sort row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor={searchInputId} className="relative flex-1">
          <span className="sr-only">Tìm sản phẩm</span>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-3.5 left-4 size-5"
          />
          <input
            id={searchInputId}
            value={filter.q}
            onChange={(e) => handleUpdate({ q: e.target.value })}
            placeholder="Tìm tên sản phẩm…"
            className="border-input bg-background focus-visible:ring-primary h-12 w-full rounded-2xl border pr-4 pl-12 text-sm transition-all outline-none focus-visible:ring-2"
          />
        </label>

        <div className="flex items-center gap-2">
          <label htmlFor={sortSelectId} className="sr-only">
            Sắp xếp theo
          </label>
          <div className="relative">
            <ArrowUpDown
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4"
            />
            <select
              id={sortSelectId}
              disabled={!hydrated}
              value={filter.sort}
              onChange={(e) =>
                handleUpdate({ sort: e.target.value as CatalogSort })
              }
              className="border-input bg-background focus-visible:ring-primary h-12 rounded-2xl border pr-8 pl-9 text-sm font-medium transition-all outline-none focus-visible:ring-2 disabled:opacity-70"
            >
              <option value="relevance">Phù hợp nhất</option>
              <option value="price-asc">Giá tăng dần</option>
              <option value="price-desc">Giá giảm dần</option>
              <option value="name-asc">Tên A - Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div
        role="group"
        aria-label="Danh mục sản phẩm"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        <button
          type="button"
          onClick={() => handleUpdate({ category: null })}
          aria-pressed={!filter.category}
          className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
            !filter.category
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Tất cả
        </button>
        {categories.map((cat) => {
          const isSelected = filter.category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleUpdate({ category: cat.id })}
              aria-pressed={isSelected}
              className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Secondary filter controls (Stock & Price Range) */}
      <div className="border-border bg-card/60 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* In Stock toggle */}
          <label
            htmlFor={inStockCheckboxId}
            className="flex cursor-pointer items-center gap-2 font-medium select-none"
          >
            <input
              id={inStockCheckboxId}
              type="checkbox"
              checked={filter.inStock}
              onChange={(e) => handleUpdate({ inStock: e.target.checked })}
              className="accent-primary size-4 rounded"
            />
            <span>Chỉ hiện còn hàng</span>
          </label>

          {/* Price range inputs */}
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-semibold uppercase">
              Giá:
            </span>
            <input
              type="number"
              aria-label="Giá tối thiểu"
              placeholder="Từ ₫"
              min={0}
              step={1000}
              value={filter.minPrice !== null ? filter.minPrice : ""}
              onChange={(e) =>
                handleUpdate({
                  minPrice: e.target.value
                    ? Math.max(0, parseInt(e.target.value, 10))
                    : null,
                })
              }
              className="border-input bg-background focus-visible:ring-primary h-9 w-24 rounded-lg border px-2 text-xs outline-none focus-visible:ring-2"
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="number"
              aria-label="Giá tối đa"
              placeholder="Đến ₫"
              min={0}
              step={1000}
              value={filter.maxPrice !== null ? filter.maxPrice : ""}
              onChange={(e) =>
                handleUpdate({
                  maxPrice: e.target.value
                    ? Math.max(0, parseInt(e.target.value, 10))
                    : null,
                })
              }
              className="border-input bg-background focus-visible:ring-primary h-9 w-24 rounded-lg border px-2 text-xs outline-none focus-visible:ring-2"
            />
          </div>
        </div>

        {/* Result count & Clear All */}
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            Tìm thấy <strong className="text-foreground">{resultCount}</strong>{" "}
            sản phẩm
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-bold underline"
            >
              <RotateCcw aria-hidden="true" className="size-3" />
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips badges */}
      {hasActiveFilters && (
        <div
          className="flex flex-wrap items-center gap-2 pt-1"
          aria-label="Bộ lọc đang chọn"
        >
          {filter.q && (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium">
              Từ khóa: {filter.q}
              <button
                type="button"
                onClick={() => handleUpdate({ q: "" })}
                aria-label="Xóa từ khóa tìm kiếm"
                className="hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          )}
          {activeCategory && (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium">
              Danh mục: {activeCategory.name}
              <button
                type="button"
                onClick={() => handleUpdate({ category: null })}
                aria-label="Xóa bộ lọc danh mục"
                className="hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          )}
          {filter.inStock && (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium">
              Còn hàng
              <button
                type="button"
                onClick={() => handleUpdate({ inStock: false })}
                aria-label="Bỏ lọc còn hàng"
                className="hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          )}
          {(filter.minPrice !== null || filter.maxPrice !== null) && (
            <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium">
              Giá:{" "}
              {filter.minPrice !== null
                ? `${formatVnd(filter.minPrice)} ₫`
                : "0 ₫"}{" "}
              -{" "}
              {filter.maxPrice !== null
                ? `${formatVnd(filter.maxPrice)} ₫`
                : "∞"}
              <button
                type="button"
                onClick={() => handleUpdate({ minPrice: null, maxPrice: null })}
                aria-label="Xóa khoảng giá"
                className="hover:text-foreground"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

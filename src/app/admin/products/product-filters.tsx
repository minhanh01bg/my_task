"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowCounterClockwise,
  CheckCircle,
  MagnifyingGlass,
  Warning,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CatalogCategory } from "@/types/catalog";

export interface StockCounts {
  all: number;
  low: number;
  out: number;
  negative: number;
  available: number;
}

export interface ProductFiltersProps {
  categories: CatalogCategory[];
  currentQuery?: string;
  currentCategoryId?: string;
  currentStatus?: string;
  counts: StockCounts;
}

export function ProductFilters({
  categories,
  currentQuery = "",
  currentCategoryId = "all",
  currentStatus = "all",
  counts,
}: ProductFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchVal, setSearchVal] = useState(currentQuery);

  const createQueryString = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      // Xoa params cu lien quan
      params.delete("lowStock");
      params.delete("edit");

      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === "all" || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      return qs ? `?${qs}` : pathname;
    },
    [searchParams, pathname],
  );

  const handleStatusChange = (status: string) => {
    startTransition(() => {
      router.push(createQueryString({ status }));
    });
  };

  const handleCategoryChange = (categoryId: string | null) => {
    if (!categoryId) return;
    startTransition(() => {
      router.push(createQueryString({ categoryId }));
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(() => {
      router.push(createQueryString({ q: searchVal.trim() }));
    });
  };

  const handleClearSearch = () => {
    setSearchVal("");
    startTransition(() => {
      router.push(createQueryString({ q: null }));
    });
  };

  const hasActiveFilters = Boolean(
    (currentStatus && currentStatus !== "all") ||
    (currentCategoryId && currentCategoryId !== "all") ||
    currentQuery.trim(),
  );

  const statusTabs = [
    {
      id: "all",
      label: "Tất cả",
      count: counts.all,
      badgeVariant: "secondary" as const,
    },
    {
      id: "low",
      label: "Cảnh báo tồn thấp (≤ 5)",
      count: counts.low,
      icon: <Warning className="size-4 text-amber-500" weight="fill" />,
      badgeVariant: "outline" as const,
      activeClass:
        "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-200",
      badgeClass:
        "bg-amber-500/20 text-amber-800 dark:text-amber-200 border-amber-500/30",
    },
    {
      id: "out",
      label: "Hết hàng (= 0)",
      count: counts.out,
      icon: <WarningCircle className="size-4 text-red-500" weight="fill" />,
      badgeVariant: "destructive" as const,
      activeClass:
        "border-red-500/50 bg-red-500/15 text-red-900 dark:text-red-200",
      badgeClass:
        "bg-red-500/20 text-red-800 dark:text-red-200 border-red-500/30",
    },
    {
      id: "negative",
      label: "Tồn âm (< 0)",
      count: counts.negative,
      badgeVariant: "destructive" as const,
      activeClass:
        "border-rose-500/50 bg-rose-500/15 text-rose-900 dark:text-rose-200",
      badgeClass:
        "bg-rose-500/20 text-rose-800 dark:text-rose-200 border-rose-500/30",
    },
    {
      id: "available",
      label: "Còn hàng (> 5)",
      count: counts.available,
      icon: <CheckCircle className="size-4 text-emerald-500" weight="fill" />,
      badgeVariant: "secondary" as const,
      activeClass:
        "border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200",
      badgeClass:
        "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
    },
  ];

  return (
    <div className="space-y-3.5">
      {/* Stock status filter chips / tabs */}
      <div
        role="tablist"
        aria-label="Lọc theo trạng thái tồn kho"
        className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1"
      >
        {statusTabs.map((tab) => {
          const isActive = currentStatus === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => handleStatusChange(tab.id)}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-bold transition-all select-none ${
                isActive
                  ? tab.activeClass ||
                    "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border/70 bg-card hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
                  isActive && tab.id === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : tab.badgeClass || "bg-muted text-foreground"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Category Filter Toolbar */}
      <div className="surface-panel flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center">
        {/* Search input form */}
        <form
          role="search"
          onSubmit={handleSearchSubmit}
          className="relative flex-1"
        >
          <MagnifyingGlass
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2"
          />
          <input
            name="q"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            aria-label="Tìm sản phẩm"
            placeholder="Tìm theo tên sản phẩm, mã SKU hoặc tên gọi khác..."
            className="border-input bg-background focus-visible:ring-primary/20 focus-visible:border-primary h-11 w-full rounded-xl border pr-9 pl-10 text-sm transition-all outline-none focus-visible:ring-3"
          />
          {searchVal ? (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Xóa từ khóa tìm kiếm"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer p-1"
            >
              <X className="size-4" weight="bold" />
            </button>
          ) : null}
        </form>

        {/* Category Select Dropdown */}
        <div className="w-full sm:w-60">
          <Select
            value={currentCategoryId}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger
              aria-label="Lọc theo danh mục"
              className="h-11 w-full rounded-xl font-medium"
            >
              <SelectValue placeholder="Tất cả danh mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả danh mục</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search button */}
        <Button
          type="button"
          onClick={handleSearchSubmit}
          className="btn-press h-11 shrink-0 font-bold"
        >
          Tìm kiếm
        </Button>

        {/* Reset filters button */}
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            type="button"
            onClick={() => {
              setSearchVal("");
              startTransition(() => {
                router.push(pathname);
              });
            }}
            className="text-muted-foreground hover:text-destructive h-11 shrink-0 gap-1.5 font-semibold"
          >
            <ArrowCounterClockwise className="size-4" weight="bold" />
            <span>Đặt lại</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

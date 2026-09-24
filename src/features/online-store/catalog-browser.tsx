"use client";

import { Suspense, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/kit/empty-state";
import { ProductCardSkeleton } from "@/components/kit/skeleton-loader";
import { useWishlist } from "@/lib/storage/wishlist";
import { catalogFilterSchema, type CatalogFilter } from "@/types/storefront";

import { CartFeedback } from "./cart-feedback";
import { CatalogFilters } from "./catalog-filters";
import { filterAndSortProducts } from "./filter-products";
import { ProductCard } from "./product-card";
import { QuickViewModal } from "./quick-view-modal";
import type { OnlineCatalog, OnlineProduct } from "./types";

const defaultFilter: CatalogFilter = {
  q: "",
  category: null,
  inStock: false,
  minPrice: null,
  maxPrice: null,
  sort: "relevance",
};

type CatalogSearchParams = ReturnType<typeof useSearchParams> | null;

function parseFilterFromParams(
  searchParams: CatalogSearchParams,
): CatalogFilter {
  if (!searchParams) return defaultFilter;
  const raw: Record<string, unknown> = {};

  if (searchParams.has("q")) raw.q = searchParams.get("q");
  if (searchParams.has("category")) raw.category = searchParams.get("category");
  if (searchParams.has("inStock"))
    raw.inStock = searchParams.get("inStock") === "true";
  if (searchParams.has("minPrice")) {
    const num = Number(searchParams.get("minPrice"));
    if (!Number.isNaN(num)) raw.minPrice = num;
  }
  if (searchParams.has("maxPrice")) {
    const num = Number(searchParams.get("maxPrice"));
    if (!Number.isNaN(num)) raw.maxPrice = num;
  }
  if (searchParams.has("sort")) raw.sort = searchParams.get("sort");

  const parsed = catalogFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultFilter;
}

/**
 * `/shop` được render tĩnh (ISR) nên `useSearchParams` phải nằm trong Suspense.
 * Fallback là danh mục mặc định (chưa lọc) để HTML tĩnh vẫn có lưới sản phẩm;
 * sau hydrate, bản đọc query string (`?q=`, `?category=`, `?wishlist=`) thay thế.
 */
export function CatalogBrowser({ catalog }: { catalog: OnlineCatalog }) {
  return (
    <Suspense
      fallback={<CatalogBrowserView catalog={catalog} searchParams={null} />}
    >
      <CatalogBrowserWithParams catalog={catalog} />
    </Suspense>
  );
}

function CatalogBrowserWithParams({ catalog }: { catalog: OnlineCatalog }) {
  const searchParams = useSearchParams();
  return <CatalogBrowserView catalog={catalog} searchParams={searchParams} />;
}

function CatalogBrowserView({
  catalog,
  searchParams,
}: {
  catalog: OnlineCatalog;
  searchParams: CatalogSearchParams;
}) {
  const [prevParams, setPrevParams] = useState(searchParams);
  const [filter, setFilter] = useState<CatalogFilter>(() =>
    parseFilterFromParams(searchParams),
  );
  // O loc cap nhat ngay (`filter`); luoi loc lai trong transition
  // (`appliedFilter`) — trong luc cho thi hien skeleton thay vi dung hinh.
  const [appliedFilter, setAppliedFilter] = useState(filter);
  const [isFiltering, startFiltering] = useTransition();

  // Adjust state on searchParams change during render (React-recommended pattern)
  if (searchParams !== prevParams) {
    const parsed = parseFilterFromParams(searchParams);
    setPrevParams(searchParams);
    setFilter(parsed);
    setAppliedFilter(parsed);
  }

  function changeFilter(next: CatalogFilter) {
    setFilter(next);
    startFiltering(() => setAppliedFilter(next));
  }

  const [quickView, setQuickView] = useState<OnlineProduct | null>(null);
  const { has: hasWishlist } = useWishlist();
  const isWishlistOnly = searchParams?.get("wishlist") === "true";

  const products = useMemo(() => {
    const base = filterAndSortProducts(catalog.products, appliedFilter);
    if (!isWishlistOnly) return base;
    return base.filter((p) => hasWishlist(p.id));
  }, [catalog.products, appliedFilter, isWishlistOnly, hasWishlist]);

  return (
    <section
      id="catalog"
      aria-labelledby="catalog-title"
      className="mx-auto max-w-7xl scroll-mt-24 px-4 py-10 sm:px-6"
    >
      <div className="max-w-2xl">
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Mua sắm thuận tiện
        </p>
        <h2
          id="catalog-title"
          className="font-heading mt-2 text-3xl font-bold sm:text-4xl"
        >
          {isWishlistOnly ? "Sản phẩm yêu thích của bạn" : "Toàn bộ sản phẩm"}
        </h2>
        <p className="text-muted-foreground mt-3 text-base">
          {isWishlistOnly
            ? "Danh sách các sản phẩm bạn đã lưu để theo dõi và mua sắm sau."
            : "Giá và tồn kho được cập nhật trực tiếp từ cửa hàng."}
        </p>
      </div>

      {isWishlistOnly && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300">
          <span>
            Đang lọc theo danh sách yêu thích ({products.length} sản phẩm)
          </span>
          <Link
            href="/shop#catalog"
            className="text-xs font-bold underline hover:no-underline"
          >
            Xem tất cả sản phẩm
          </Link>
        </div>
      )}

      <div className="mt-8">
        <CatalogFilters
          categories={catalog.categories}
          filter={filter}
          onFilterChange={changeFilter}
          resultCount={products.length}
        />
      </div>

      {isFiltering ? (
        <div
          data-testid="catalog-skeleton"
          aria-busy="true"
          className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          <span role="status" className="sr-only">
            Đang lọc sản phẩm…
          </span>
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : products.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onQuickView={setQuickView}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState
            title="Không tìm thấy sản phẩm phù hợp"
            description="Thử thay đổi từ khóa, khoảng giá hoặc bỏ bớt các bộ lọc đang áp dụng."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => changeFilter(defaultFilter)}
                className="font-bold"
              >
                Xóa tất cả bộ lọc
              </Button>
            }
          />
        </div>
      )}

      <QuickViewModal product={quickView} onClose={() => setQuickView(null)} />
      <CartFeedback />
    </section>
  );
}

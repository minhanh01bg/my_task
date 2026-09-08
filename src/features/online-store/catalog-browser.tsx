"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";

import { formatVnd } from "@/lib/money";
import { catalogFilterSchema, type CatalogFilter } from "@/types/storefront";

import { useOnlineCart } from "./cart-context";
import { CartFeedback } from "./cart-feedback";
import { CatalogFilters } from "./catalog-filters";
import { filterAndSortProducts } from "./filter-products";
import type { OnlineCatalog } from "./types";

const defaultFilter: CatalogFilter = {
  q: "",
  category: null,
  inStock: false,
  minPrice: null,
  maxPrice: null,
  sort: "relevance",
};

function parseFilterFromParams(
  searchParams: URLSearchParams | null,
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

export function CatalogBrowser({ catalog }: { catalog: OnlineCatalog }) {
  const searchParams = useSearchParams();
  const { add } = useOnlineCart();

  const [prevParams, setPrevParams] = useState(searchParams);
  const [filter, setFilter] = useState<CatalogFilter>(() =>
    parseFilterFromParams(searchParams),
  );

  // Adjust state on searchParams change during render (React-recommended pattern)
  if (searchParams !== prevParams) {
    setPrevParams(searchParams);
    setFilter(parseFilterFromParams(searchParams));
  }

  const products = useMemo(
    () => filterAndSortProducts(catalog.products, filter),
    [catalog.products, filter],
  );

  return (
    <section
      aria-labelledby="catalog-title"
      className="mx-auto max-w-7xl px-4 py-10 sm:px-6"
    >
      <div className="max-w-2xl">
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Mua sắm thuận tiện
        </p>
        <h1
          id="catalog-title"
          className="font-heading mt-2 text-4xl font-bold sm:text-5xl"
        >
          Hàng thiết yếu, đặt nhanh tại nhà
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Giá và tồn kho được cập nhật trực tiếp từ cửa hàng.
        </p>
      </div>

      <div className="mt-8">
        <CatalogFilters
          categories={catalog.categories}
          filter={filter}
          onFilterChange={setFilter}
          resultCount={products.length}
        />
      </div>

      {products.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <article
              key={product.id}
              className="border-border bg-card overflow-hidden rounded-2xl border shadow-xs"
            >
              <div className="bg-muted relative aspect-square">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    Chưa có ảnh
                  </div>
                )}
              </div>
              <div className="p-4">
                <h2 className="line-clamp-2 min-h-12 font-bold">
                  {product.name}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  /{product.unit}
                </p>
                <p className="text-primary mt-2 text-lg font-bold">
                  {formatVnd(product.price)} ₫
                </p>
                <button
                  type="button"
                  disabled={product.stock <= 0}
                  onClick={() => add(product)}
                  aria-label={
                    product.stock > 0
                      ? `Thêm ${product.name} vào giỏ`
                      : `${product.name} đã hết hàng`
                  }
                  className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 font-bold transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart aria-hidden="true" className="size-4" />
                  {product.stock > 0 ? "Thêm vào giỏ" : "Hết hàng"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="bg-muted/40 border-border mt-8 rounded-2xl border p-12 text-center">
          <p className="text-base font-bold">Không tìm thấy sản phẩm phù hợp</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Thử thay đổi từ khóa, khoảng giá hoặc bỏ bớt các bộ lọc đang áp
            dụng.
          </p>
          <button
            type="button"
            onClick={() => setFilter(defaultFilter)}
            className="text-primary hover:text-primary/80 mt-4 inline-flex min-h-11 items-center font-bold underline"
          >
            Xóa tất cả bộ lọc
          </button>
        </div>
      )}

      <CartFeedback />
    </section>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/kit/empty-state";
import { Money } from "@/components/kit/money";
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
          Toàn bộ sản phẩm
        </h2>
        <p className="text-muted-foreground mt-3 text-base">
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
              className="border-border bg-card overflow-hidden rounded-2xl border shadow-xs transition-all hover:shadow-md"
            >
              <div className="bg-muted relative aspect-square">
                {product.stock <= 0 ? (
                  <div className="absolute top-2.5 right-2.5 z-10">
                    <Badge
                      variant="destructive"
                      className="font-bold shadow-xs"
                    >
                      Hết hàng
                    </Badge>
                  </div>
                ) : null}
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
                <div className="text-primary mt-2 text-lg font-bold">
                  <Money amount={product.price} />
                </div>
                <Button
                  type="button"
                  disabled={product.stock <= 0}
                  onClick={() => add(product)}
                  aria-label={
                    product.stock > 0
                      ? `Thêm ${product.name} vào giỏ`
                      : `${product.name} đã hết hàng`
                  }
                  className="mt-4 min-h-11 w-full font-bold"
                >
                  <ShoppingCart aria-hidden="true" className="size-4" />
                  {product.stock > 0 ? "Thêm vào giỏ" : "Hết hàng"}
                </Button>
              </div>
            </article>
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
                onClick={() => setFilter(defaultFilter)}
                className="font-bold"
              >
                Xóa tất cả bộ lọc
              </Button>
            }
          />
        </div>
      )}

      <CartFeedback />
    </section>
  );
}

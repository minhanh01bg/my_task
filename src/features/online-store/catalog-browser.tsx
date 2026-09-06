"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, ShoppingCart } from "lucide-react";

import { formatVnd } from "@/lib/money";
import { normalize } from "@/lib/search/normalize";

import { useOnlineCart } from "./cart-context";
import type { OnlineCatalog } from "./types";

export function CatalogBrowser({ catalog }: { catalog: OnlineCatalog }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const { add } = useOnlineCart();
  const products = useMemo(() => {
    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    return catalog.products.filter(
      (product) =>
        (!category || product.categoryId === category) &&
        tokens.every((token) =>
          normalize(`${product.name} ${product.searchText}`).includes(token),
        ),
    );
  }, [catalog.products, category, query]);

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
      <label className="relative mt-8 block max-w-2xl">
        <span className="sr-only">Tìm sản phẩm</span>
        <Search
          aria-hidden="true"
          className="text-muted-foreground absolute top-3.5 left-4 size-5"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm tên sản phẩm…"
          className="border-input bg-background h-12 w-full rounded-2xl border pr-4 pl-12 outline-none focus-visible:ring-3"
        />
      </label>
      <div
        className="mt-5 flex gap-2 overflow-x-auto pb-2"
        aria-label="Danh mục"
      >
        <button
          onClick={() => setCategory("")}
          className={`min-h-11 shrink-0 rounded-full px-4 font-bold ${!category ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          Tất cả
        </button>
        {catalog.categories.map((item) => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 font-bold ${category === item.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
          >
            {item.name}
          </button>
        ))}
      </div>
      {products.length ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <article
              key={product.id}
              className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm"
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
                  disabled={product.stock <= 0}
                  onClick={() => add(product)}
                  className="bg-primary text-primary-foreground mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ShoppingCart aria-hidden="true" className="size-4" />
                  {product.stock > 0 ? "Thêm vào giỏ" : "Hết hàng"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="bg-muted mt-8 rounded-2xl p-10 text-center">
          <p className="font-bold">Không tìm thấy sản phẩm</p>
          <button
            onClick={() => {
              setQuery("");
              setCategory("");
            }}
            className="text-primary mt-3 min-h-11 font-bold underline"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
    </section>
  );
}

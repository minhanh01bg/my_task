import { expect, it } from "vitest";

import type { OnlineCatalog } from "@/features/online-store/types";
import { buildPreviewSlides } from "@/features/slider-preview/preview-slides";

const catalog: OnlineCatalog = {
  categories: [
    { id: "food", name: "Tạp hoá", slug: "tap-hoa" },
    { id: "shoes", name: "Giày dép", slug: "giay-dep" },
  ],
  products: [
    {
      id: "no-image",
      name: "Chưa có ảnh",
      price: 1000,
      unit: "cái",
      stock: 3,
      imageUrl: null,
      categoryId: "food",
      searchText: "",
    },
    {
      id: "one",
      slug: "mi-hao-hao",
      name: "Mì Hảo Hảo",
      price: 4500,
      unit: "gói",
      stock: 10,
      imageUrl: "/products/mi-hao-hao.webp",
      categoryId: "food",
      searchText: "",
    },
    {
      id: "two",
      name: "Nước ngọt",
      price: 12000,
      unit: "lon",
      stock: 10,
      imageUrl: "/products/coca-cola-can-320ml.webp",
      categoryId: "food",
      searchText: "",
    },
    {
      id: "three",
      slug: "dep-lao",
      name: "Dép lào",
      price: 35000,
      unit: "đôi",
      stock: 10,
      imageUrl: "/products/dep-lao.webp",
      categoryId: "shoes",
      searchText: "",
    },
  ],
};

it("prioritizes different categories with real images and preserves price and destination", () => {
  const slides = buildPreviewSlides(catalog);
  expect(slides.map((slide) => slide.id)).toEqual(["one", "three", "two"]);
  expect(slides[0]).toMatchObject({
    productHref: "/shop/p/mi-hao-hao",
    categoryHref: "/shop/c/tap-hoa",
    price: 4500,
    productName: "Mì Hảo Hảo",
  });
  expect(slides[2].productHref).toBe("/shop/products/two");
});

it("limits the showcase to five distinct products", () => {
  const products = Array.from({ length: 8 }, (_, index) => ({
    ...catalog.products[1],
    id: `item-${index}`,
  }));
  expect(buildPreviewSlides({ ...catalog, products })).toHaveLength(5);
});

it("returns no invented products when the catalog has no usable images", () => {
  expect(
    buildPreviewSlides({ categories: [], products: [catalog.products[0]] }),
  ).toEqual([]);
});

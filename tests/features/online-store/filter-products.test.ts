import { describe, expect, it } from "vitest";

import { filterAndSortProducts } from "@/features/online-store/filter-products";
import type { OnlineProduct } from "@/features/online-store/types";
import type { CatalogFilter } from "@/types/storefront";

const mockProducts: OnlineProduct[] = [
  {
    id: "p1",
    name: "Cà phê sữa đá",
    price: 25_000,
    unit: "ly",
    stock: 10,
    imageUrl: null,
    categoryId: "drink",
    searchText: "ca phe sua da nuoc",
  },
  {
    id: "p2",
    name: "Bạc xỉu",
    price: 30_000,
    unit: "ly",
    stock: 5,
    imageUrl: null,
    categoryId: "drink",
    searchText: "bac xiu ca phe sua",
  },
  {
    id: "p3",
    name: "Bánh mì pate",
    price: 20_000,
    unit: "ổ",
    stock: 0,
    imageUrl: null,
    categoryId: "food",
    searchText: "banh mi thit pate",
  },
  {
    id: "p4",
    name: "Bánh ngọt phô mai",
    price: 45_000,
    unit: "cái",
    stock: 2,
    imageUrl: null,
    categoryId: "food",
    searchText: "banh ngot pho mai",
  },
];

const defaultFilter: CatalogFilter = {
  q: "",
  category: null,
  inStock: false,
  minPrice: null,
  maxPrice: null,
  sort: "relevance",
};

describe("filterAndSortProducts", () => {
  it("trả toàn bộ danh sách khi filter mặc định", () => {
    const result = filterAndSortProducts(mockProducts, defaultFilter);
    expect(result).toHaveLength(4);
  });

  it("tìm kiếm bỏ dấu kết hợp AND", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      q: "ca phe sua",
    });
    // Cả "Cà phê sữa đá" và "Bạc xỉu" đều chứa ca phe + sua
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("lọc theo category", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      category: "food",
    });
    expect(result.map((p) => p.id)).toEqual(["p3", "p4"]);
  });

  it("lọc theo inStock chỉ lấy sản phẩm có stock > 0", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      inStock: true,
    });
    expect(result.find((p) => p.id === "p3")).toBeUndefined();
    expect(result).toHaveLength(3);
  });

  it("lọc theo khoảng giá minPrice và maxPrice", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      minPrice: 22_000,
      maxPrice: 35_000,
    });
    // p1 (25k), p2 (30k)
    expect(result.map((p) => p.id)).toEqual(["p1", "p2"]);
  });

  it("kết hợp nhiều tiêu chí tìm kiếm, category, còn hàng và giá", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      q: "banh",
      category: "food",
      inStock: true,
      minPrice: 20_000,
    });
    // p4 (Bánh ngọt phô mai, food, stock 2, 45k)
    expect(result.map((p) => p.id)).toEqual(["p4"]);
  });

  it("sắp xếp theo giá tăng dần (price-asc)", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      sort: "price-asc",
    });
    expect(result.map((p) => p.price)).toEqual([
      20_000, 25_000, 30_000, 45_000,
    ]);
  });

  it("sắp xếp theo giá giảm dần (price-desc)", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      sort: "price-desc",
    });
    expect(result.map((p) => p.price)).toEqual([
      45_000, 30_000, 25_000, 20_000,
    ]);
  });

  it("sắp xếp theo tên A-Z (name-asc)", () => {
    const result = filterAndSortProducts(mockProducts, {
      ...defaultFilter,
      sort: "name-asc",
    });
    // Bạc xỉu, Bánh mì pate, Bánh ngọt phô mai, Cà phê sữa đá
    expect(result.map((p) => p.id)).toEqual(["p2", "p3", "p4", "p1"]);
  });

  it("sắp xếp theo bán chạy nhất (best-selling) theo soldCount giảm dần", () => {
    const productsWithSales: OnlineProduct[] = [
      { ...mockProducts[0], id: "p1", soldCount: 5 },
      { ...mockProducts[1], id: "p2", soldCount: 50 },
      { ...mockProducts[2], id: "p3", soldCount: 12 },
      { ...mockProducts[3], id: "p4", soldCount: 0 },
    ];
    const result = filterAndSortProducts(productsWithSales, {
      ...defaultFilter,
      sort: "best-selling",
    });
    expect(result.map((p) => p.id)).toEqual(["p2", "p3", "p1", "p4"]);
  });
});

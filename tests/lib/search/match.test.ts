import { describe, expect, it } from "vitest";

import { searchProducts } from "@/lib/search/match";
import { buildSearchText } from "@/lib/search/search-text";
import type { SearchableProduct } from "@/lib/search/types";

function product(
  name: string,
  overrides: Partial<SearchableProduct> & { aliases?: string } = {},
): SearchableProduct {
  const { aliases, ...rest } = overrides;
  return {
    id: name,
    name,
    sku: rest.sku ?? null,
    price: 10000,
    unit: "cái",
    stock: 10,
    categoryId: null,
    soldCount: 0,
    imageUrl: null,
    searchText: buildSearchText({ name, aliases, sku: rest.sku ?? null }),
    ...rest,
  };
}

describe("searchProducts", () => {
  it("tim duoc du go khong dau", () => {
    const items = [product("Nhớt Castrol Power1"), product("Đường trắng")];
    const found = searchProducts(items, "nhot");
    expect(found.map((p) => p.name)).toEqual(["Nhớt Castrol Power1"]);
  });

  it("khop nhieu tu roi, khong can dung thu tu", () => {
    const items = [
      product("Bộ nhông sên dĩa xe Wave"),
      product("Nhớt Castrol Power1"),
    ];
    const found = searchProducts(items, "sen wave");
    expect(found.map((p) => p.name)).toEqual(["Bộ nhông sên dĩa xe Wave"]);
  });

  it("phai khop TAT CA cac tu moi hien", () => {
    const items = [product("Bộ nhông sên dĩa xe Wave")];
    expect(searchProducts(items, "sen dream")).toEqual([]);
  });

  it("tim duoc qua tu khoa phu (aliases)", () => {
    const items = [product("Bugi NGK C7HSA", { aliases: "bugi wave" })];
    const found = searchProducts(items, "bugi wave");
    expect(found.map((p) => p.name)).toEqual(["Bugi NGK C7HSA"]);
  });

  it("go tien to ngan tim thay bugi ngay", () => {
    const items = [product("Bugi NGK C7HSA"), product("Bộ nhông sên dĩa")];
    expect(searchProducts(items, "bu").map((p) => p.name)).toEqual([
      "Bugi NGK C7HSA",
    ]);
  });

  it("van tim theo ten khi searchText trong database bi rong hoac cu", () => {
    const emptySearchText = product("Bugi NGK C7HSA", { searchText: "" });
    const staleSearchText = product("Bugi Denso U22", {
      searchText: "san pham cu",
    });

    expect(
      searchProducts([emptySearchText, staleSearchText], "bu").map(
        (p) => p.name,
      ),
    ).toEqual(["Bugi Denso U22", "Bugi NGK C7HSA"]);
  });

  it("trung sku len dau tuyet doi", () => {
    const items = [
      product("Aaa hàng đầu bảng", { sku: null }),
      product("Bugi NGK C7HSA", { sku: "PT-102", soldCount: 0 }),
      product("PT-102 giả mạo trong tên", { sku: null, soldCount: 999 }),
    ];
    const found = searchProducts(items, "PT-102");
    expect(found[0]?.name).toBe("Bugi NGK C7HSA");
  });

  it("khop dau ten xep tren khop giua tu", () => {
    const items = [
      product("Xà phòng Coca giả"),
      product("Coca Cola chai 390ml"),
    ];
    const found = searchProducts(items, "coca");
    expect(found[0]?.name).toBe("Coca Cola chai 390ml");
  });

  it("khop dau mot tu bat ky xep tren khop giua tu", () => {
    // "coca" nam GIUA tu "pepsicoca" -> bac 3
    // "coca" nam DAU tu thu hai cua "Chai Coca" -> bac 2
    const items = [product("Nước ngọt Pepsicoca"), product("Chai Coca 390ml")];
    const found = searchProducts(items, "coca");
    expect(found[0]?.name).toBe("Chai Coca 390ml");
  });

  it("token la tien to cua mot tu van tinh la khop dau tu", () => {
    // "coca" la tien to cua "cocacola" -> van bac 2, khong bi coi la khop giua
    const items = [product("Bánh tráng cocacola nhái")];
    expect(searchProducts(items, "coca")).toHaveLength(1);
  });

  it("cung bac thi mon ban chay hon xep tren", () => {
    const items = [
      product("Coca Cola lon 320ml", { soldCount: 5 }),
      product("Coca Cola chai 390ml", { soldCount: 120 }),
    ];
    const found = searchProducts(items, "coca cola");
    expect(found[0]?.name).toBe("Coca Cola chai 390ml");
  });

  it("query rong tra ve mang rong", () => {
    const items = [product("Nhớt Castrol Power1")];
    expect(searchProducts(items, "  ")).toEqual([]);
  });

  it("gioi han so ket qua tra ve", () => {
    const items = Array.from({ length: 50 }, (_, i) =>
      product(`Nước ngọt số ${i}`),
    );
    expect(searchProducts(items, "nuoc", 10)).toHaveLength(10);
  });
});

import { describe, expect, it } from "vitest";

import { categoryHref, productHref } from "@/lib/seo/product-href";

describe("productHref", () => {
  it("dùng URL slug khi sản phẩm có slug", () => {
    expect(productHref({ id: "p1", slug: "bugi-ngk" })).toBe(
      "/shop/p/bugi-ngk",
    );
  });

  it("quay về URL id khi chưa có slug (dữ liệu cũ, localStorage cũ)", () => {
    expect(productHref({ id: "p1", slug: null })).toBe("/shop/products/p1");
    expect(productHref({ id: "p1" })).toBe("/shop/products/p1");
    expect(productHref({ id: "p1", slug: "" })).toBe("/shop/products/p1");
  });
});

describe("categoryHref", () => {
  it("dùng trang danh mục khi có slug", () => {
    expect(categoryHref({ id: "c1", slug: "mi-goi" })).toBe("/shop/c/mi-goi");
  });

  it("quay về bộ lọc /shop?category= khi chưa có slug", () => {
    expect(categoryHref({ id: "c 1", slug: null })).toBe(
      "/shop?category=c%201#catalog",
    );
  });
});

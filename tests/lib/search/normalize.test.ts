import { describe, expect, it } from "vitest";

import { normalize, tokenize } from "@/lib/search/normalize";
import { buildSearchText } from "@/lib/search/search-text";

describe("normalize", () => {
  it("bo dau tieng Viet", () => {
    expect(normalize("Nhớt Castrol")).toBe("nhot castrol");
    expect(normalize("Dép tông Lào")).toBe("dep tong lao");
    expect(normalize("Bộ nhông sên dĩa")).toBe("bo nhong sen dia");
  });

  it("xu ly chu D gach ngang", () => {
    expect(normalize("Đường")).toBe("duong");
    expect(normalize("ĐÈN LED")).toBe("den led");
  });

  it("gop khoang trang thua", () => {
    expect(normalize("  Nhớt   Castrol  ")).toBe("nhot castrol");
  });

  it("giu lai chu so va ky tu thuong dung trong ten hang", () => {
    expect(normalize("Coca 390ml")).toBe("coca 390ml");
    expect(normalize("PT-102")).toBe("pt-102");
  });
});

describe("tokenize", () => {
  it("tach query thanh cac tu da chuan hoa", () => {
    expect(tokenize("Sên Wave")).toEqual(["sen", "wave"]);
  });

  it("bo qua khoang trang thua", () => {
    expect(tokenize("  nhot   castrol ")).toEqual(["nhot", "castrol"]);
  });

  it("query rong tra ve mang rong", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("buildSearchText", () => {
  it("gop ten, aliases, sku va danh muc", () => {
    const result = buildSearchText({
      name: "Bugi NGK C7HSA",
      aliases: "bugi wave, bugi thường",
      sku: "PT-102",
      categoryName: "Phụ tùng xe",
    });

    expect(result).toContain("bugi ngk c7hsa");
    expect(result).toContain("bugi wave");
    expect(result).toContain("bugi thuong");
    expect(result).toContain("pt-102");
    expect(result).toContain("phu tung xe");
  });

  it("chap nhan thieu aliases, sku, danh muc", () => {
    expect(buildSearchText({ name: "Đường trắng" })).toBe("duong trang");
  });
});

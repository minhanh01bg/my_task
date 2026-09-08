import { describe, expect, it } from "vitest";

import {
  cartMutationResultSchema,
  catalogFilterSchema,
  publicPromotionSchema,
  publicStoreProfileSchema,
} from "@/types/storefront";

describe("catalogFilterSchema", () => {
  it("áp dụng giá trị mặc định khi query rỗng", () => {
    const parsed = catalogFilterSchema.parse({});
    expect(parsed).toEqual({
      q: "",
      category: null,
      inStock: false,
      minPrice: null,
      maxPrice: null,
      sort: "relevance",
    });
  });

  it("chuẩn hóa query hợp lệ và trim khoảng trắng", () => {
    const parsed = catalogFilterSchema.parse({
      q: "  bánh mì  ",
      category: "cat-1",
      inStock: true,
      minPrice: 10000,
      maxPrice: 50000,
      sort: "price-asc",
    });
    expect(parsed.q).toBe("bánh mì");
    expect(parsed.category).toBe("cat-1");
    expect(parsed.inStock).toBe(true);
    expect(parsed.minPrice).toBe(10000);
    expect(parsed.maxPrice).toBe(50000);
    expect(parsed.sort).toBe("price-asc");
  });

  it("từ chối minPrice lớn hơn maxPrice", () => {
    const result = catalogFilterSchema.safeParse({
      minPrice: 60000,
      maxPrice: 20000,
    });
    expect(result.success).toBe(false);
  });

  it("từ chối giá trị sort không hợp lệ", () => {
    const result = catalogFilterSchema.safeParse({
      sort: "random-invalid-sort",
    });
    expect(result.success).toBe(false);
  });

  it("từ chối giá trị giá âm hoặc số thực phân số", () => {
    expect(catalogFilterSchema.safeParse({ minPrice: -5000 }).success).toBe(
      false,
    );
    expect(catalogFilterSchema.safeParse({ maxPrice: 12.5 }).success).toBe(
      false,
    );
  });

  it("từ chối unknown keys (strict)", () => {
    const result = catalogFilterSchema.safeParse({
      q: "test",
      unexpectedKey: "malicious",
    });
    expect(result.success).toBe(false);
  });
});

describe("cartMutationResultSchema", () => {
  it("hợp lệ với trạng thái added", () => {
    const result = cartMutationResultSchema.safeParse({
      status: "added",
      productId: "prod-1",
      productName: "Cà phê sữa",
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it("hợp lệ với trạng thái incremented", () => {
    const result = cartMutationResultSchema.safeParse({
      status: "incremented",
      productId: "prod-1",
      productName: "Cà phê sữa",
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it("hợp lệ với trạng thái capped kèm maxAvailable", () => {
    const result = cartMutationResultSchema.safeParse({
      status: "capped",
      productId: "prod-1",
      productName: "Cà phê sữa",
      quantity: 5,
      maxAvailable: 5,
      message: "Đã đạt số lượng tồn kho tối đa",
    });
    expect(result.success).toBe(true);
  });

  it("hợp lệ với trạng thái unavailable", () => {
    const result = cartMutationResultSchema.safeParse({
      status: "unavailable",
      productId: "prod-2",
      productName: "Bánh ngọt",
      quantity: 0,
      message: "Sản phẩm hiện không còn bán hoặc hết hàng",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối status không nằm trong danh mục định nghĩa", () => {
    const result = cartMutationResultSchema.safeParse({
      status: "unknown_status",
      productId: "prod-1",
      productName: "Cà phê sữa",
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("publicStoreProfileSchema", () => {
  it("chuẩn hóa store profile hợp lệ", () => {
    const result = publicStoreProfileSchema.safeParse({
      name: "An Phát Store",
      hotline: "0901234567",
      address: "123 Lê Lợi, Quận 1, TP.HCM",
      openingHours: "08:00 - 21:00",
      mapUrl: "https://maps.google.com/?q=123",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối mapUrl không an toàn (javascript: hoặc http không bảo mật)", () => {
    expect(
      publicStoreProfileSchema.safeParse({
        name: "An Phát",
        mapUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);

    expect(
      publicStoreProfileSchema.safeParse({
        name: "An Phát",
        mapUrl: "http://insecure.com",
      }).success,
    ).toBe(false);
  });

  it("từ chối unknown keys nhằm tránh lộ cấu hình nội bộ", () => {
    expect(
      publicStoreProfileSchema.safeParse({
        name: "An Phát",
        internalToken: "secret123",
      }).success,
    ).toBe(false);
  });
});

describe("publicPromotionSchema", () => {
  it("chuẩn hóa campaign hợp lệ với internal CTA", () => {
    const result = publicPromotionSchema.safeParse({
      id: "promo-1",
      title: "Ưu đãi khai trương",
      body: "Giảm 10% cho đơn hàng đầu tiên",
      ctaLabel: "Mua ngay",
      ctaHref: "/shop?category=sale",
      placement: "hero",
      priority: 1,
    });
    expect(result.success).toBe(true);
  });

  it("cho phép external CTA nếu dùng https an toàn", () => {
    const result = publicPromotionSchema.safeParse({
      id: "promo-2",
      title: "Thông báo fanpage",
      ctaHref: "https://facebook.com/anphat",
      placement: "announcement",
      priority: 0,
    });
    expect(result.success).toBe(true);
  });

  it("từ chối unsafe CTA href", () => {
    expect(
      publicPromotionSchema.safeParse({
        id: "promo-bad",
        title: "Malicious",
        ctaHref: "javascript:alert(1)",
        placement: "hero",
        priority: 0,
      }).success,
    ).toBe(false);

    expect(
      publicPromotionSchema.safeParse({
        id: "promo-bad-2",
        title: "Insecure HTTP",
        ctaHref: "http://untrusted.com",
        placement: "hero",
        priority: 0,
      }).success,
    ).toBe(false);
  });

  it("từ chối copy quá dài vượt quá ngưỡng an toàn UI", () => {
    const result = publicPromotionSchema.safeParse({
      id: "promo-long",
      title: "A".repeat(300),
      placement: "hero",
      priority: 0,
    });
    expect(result.success).toBe(false);
  });
});

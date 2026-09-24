import { describe, expect, it } from "vitest";

import { productCrumbs, toBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import {
  breadcrumbJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  productJsonLd,
  serializeJsonLd,
  webSiteJsonLd,
} from "@/lib/seo/json-ld";
import type { PublicStoreProfile } from "@/types/storefront";

const SITE = "https://shop.example.com";

const fullProfile: PublicStoreProfile = {
  name: "Tạp hoá Minh An",
  hotline: "0901234567",
  address: "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
  openingHours: "Mo-Su 07:00-21:00",
};

const minimalProfile: PublicStoreProfile = { name: "Cửa hàng" };

const product = {
  id: "prod-01",
  name: "Mì Hảo Hảo tôm chua cay",
  sku: "MI-001",
  price: 4_500,
  stock: 12,
  imageUrl: "/products/mi-hao-hao.webp",
  category: { id: "cat-01", name: "Mì gói" },
};

describe("organizationJsonLd", () => {
  it("có @context, @type Organization, tên, url và logo tuyệt đối", () => {
    const data = organizationJsonLd(fullProfile, SITE);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Tạp hoá Minh An",
      url: SITE,
      telephone: "0901234567",
    });
    expect(String(data.logo)).toMatch(/^https:\/\/shop\.example\.com\//);
  });

  it("bỏ telephone khi chưa khai báo hotline", () => {
    expect(organizationJsonLd(minimalProfile, SITE)).not.toHaveProperty(
      "telephone",
    );
  });
});

describe("webSiteJsonLd", () => {
  it("khai báo SearchAction trỏ tới tìm kiếm /shop?q=", () => {
    const data = webSiteJsonLd(SITE, "Tạp hoá Minh An");
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      url: SITE,
      name: "Tạp hoá Minh An",
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE}/shop?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    });
  });
});

describe("localBusinessJsonLd", () => {
  it("dùng @type Store với PostalAddress, giờ mở cửa và điện thoại", () => {
    const data = localBusinessJsonLd(fullProfile, SITE);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Store",
      name: "Tạp hoá Minh An",
      url: `${SITE}/shop`,
      telephone: "0901234567",
      openingHours: "Mo-Su 07:00-21:00",
      address: {
        "@type": "PostalAddress",
        streetAddress: "12 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
        addressCountry: "VN",
      },
    });
    expect(String(data.image)).toMatch(/^https:\/\//);
  });

  it("bỏ address, openingHours, telephone khi hồ sơ chưa có", () => {
    const data = localBusinessJsonLd(minimalProfile, SITE);
    expect(data).not.toHaveProperty("address");
    expect(data).not.toHaveProperty("openingHours");
    expect(data).not.toHaveProperty("telephone");
  });
});

describe("productJsonLd", () => {
  const url = `${SITE}/shop/products/prod-01`;

  it("có tên, ảnh tuyệt đối, brand, offers VND và url canonical", () => {
    const data = productJsonLd(product, url, fullProfile);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Mì Hảo Hảo tôm chua cay",
      sku: "MI-001",
      category: "Mì gói",
      url,
      image: [`${SITE}/products/mi-hao-hao.webp`],
      brand: { "@type": "Brand", name: "Tạp hoá Minh An" },
      offers: {
        "@type": "Offer",
        price: 4_500,
        priceCurrency: "VND",
        availability: "https://schema.org/InStock",
        url,
      },
    });
    expect(typeof data.description).toBe("string");
  });

  it("OutOfStock khi hết hàng", () => {
    const data = productJsonLd({ ...product, stock: 0 }, url, fullProfile);
    expect(data.offers).toMatchObject({
      availability: "https://schema.org/OutOfStock",
    });
  });

  it("giữ nguyên ảnh đã là URL tuyệt đối", () => {
    const data = productJsonLd(
      { ...product, imageUrl: "https://cdn.example.com/a.webp" },
      url,
      fullProfile,
    );
    expect(data.image).toEqual(["https://cdn.example.com/a.webp"]);
  });

  it("không có aggregateRating, image hay sku khi thiếu dữ liệu", () => {
    const data = productJsonLd(
      { ...product, imageUrl: null, sku: null, category: null },
      url,
      minimalProfile,
    );
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("image");
    expect(data).not.toHaveProperty("sku");
    expect(data).not.toHaveProperty("category");
  });
});

describe("breadcrumbJsonLd", () => {
  it("đánh số position từ 1 theo thứ tự và giữ URL tuyệt đối", () => {
    const data = breadcrumbJsonLd([
      { name: "Trang chủ", url: `${SITE}/` },
      { name: "Cửa hàng", url: `${SITE}/shop` },
      { name: "Chính sách giao hàng", url: `${SITE}/shop/delivery-policy` },
    ]);
    expect(data).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Trang chủ",
          item: `${SITE}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Cửa hàng",
          item: `${SITE}/shop`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "Chính sách giao hàng",
          item: `${SITE}/shop/delivery-policy`,
        },
      ],
    });
  });
});

describe("serializeJsonLd", () => {
  it("escape `<` để tên sản phẩm không đóng được thẻ script", () => {
    const html = serializeJsonLd({ name: "</script><script>alert(1)" });
    expect(html).not.toContain("<");
    expect(JSON.parse(html)).toEqual({ name: "</script><script>alert(1)" });
  });
});

describe("breadcrumbs helpers", () => {
  it("productCrumbs: Trang chủ → Cửa hàng → Danh mục → Sản phẩm", () => {
    expect(productCrumbs(product)).toEqual([
      { name: "Trang chủ", path: "/" },
      { name: "Cửa hàng", path: "/shop" },
      { name: "Mì gói", path: "/shop?category=cat-01#catalog" },
      { name: "Mì Hảo Hảo tôm chua cay", path: "/shop/products/prod-01" },
    ]);
  });

  it("productCrumbs: dùng URL slug của sản phẩm và danh mục khi có", () => {
    expect(
      productCrumbs({
        ...product,
        slug: "mi-hao-hao-tom-chua-cay",
        category: { id: "cat-01", name: "Mì gói", slug: "mi-goi" },
      }).slice(-2),
    ).toEqual([
      { name: "Mì gói", path: "/shop/c/mi-goi" },
      {
        name: "Mì Hảo Hảo tôm chua cay",
        path: "/shop/p/mi-hao-hao-tom-chua-cay",
      },
    ]);
  });

  it("productCrumbs: bỏ cấp danh mục khi sản phẩm không có danh mục", () => {
    expect(
      productCrumbs({ ...product, category: null }).map((c) => c.name),
    ).toEqual(["Trang chủ", "Cửa hàng", "Mì Hảo Hảo tôm chua cay"]);
  });

  it("toBreadcrumbItems: URL tuyệt đối, bỏ #hash", () => {
    expect(toBreadcrumbItems(productCrumbs(product), SITE)).toEqual([
      { name: "Trang chủ", url: `${SITE}/` },
      { name: "Cửa hàng", url: `${SITE}/shop` },
      { name: "Mì gói", url: `${SITE}/shop?category=cat-01` },
      {
        name: "Mì Hảo Hảo tôm chua cay",
        url: `${SITE}/shop/products/prod-01`,
      },
    ]);
  });
});

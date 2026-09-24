import type { PublicStoreProfile } from "@/types/storefront";

/**
 * Builder JSON-LD (schema.org) thuần: không đọc DB/env, mọi URL truyền vào
 * phải là URL tuyệt đối. Trang tự lấy dữ liệu qua loader có cache rồi gọi.
 */

const SCHEMA_CONTEXT = "https://schema.org";
const LOGO_PATH = "/icon-512.png";

export type JsonLd = Record<string, unknown>;

export interface JsonLdProduct {
  id: string;
  name: string;
  sku?: string | null;
  /** VND, số nguyên. */
  price: number;
  stock: number;
  imageUrl: string | null;
  category?: { id: string; name: string } | null;
}

export interface BreadcrumbItem {
  name: string;
  /** URL tuyệt đối. */
  url: string;
}

/** Đổi đường dẫn tương đối (vd. `/products/a.webp`) thành URL tuyệt đối theo `base`. */
function toAbsoluteUrl(pathOrUrl: string, base: string): string {
  return new URL(pathOrUrl, base).href;
}

export function organizationJsonLd(
  profile: PublicStoreProfile,
  url: string,
): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Organization",
    "@id": `${url}/#organization`,
    name: profile.name,
    // `/` chuyển hướng 308 sang /shop: khai báo URL đích để không trỏ vào redirect.
    url: `${url}/shop`,
    logo: toAbsoluteUrl(LOGO_PATH, url),
    ...(profile.hotline ? { telephone: profile.hotline } : {}),
  };
}

export function webSiteJsonLd(url: string, name?: string): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": `${url}/#website`,
    url,
    ...(name ? { name } : {}),
    inLanguage: "vi-VN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function localBusinessJsonLd(
  profile: PublicStoreProfile,
  url: string,
): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Store",
    "@id": `${url}/#store`,
    name: profile.name,
    url: `${url}/shop`,
    image: toAbsoluteUrl(LOGO_PATH, url),
    parentOrganization: { "@id": `${url}/#organization` },
    ...(profile.hotline ? { telephone: profile.hotline } : {}),
    ...(profile.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: profile.address,
            addressCountry: "VN",
          },
        }
      : {}),
    // Chuỗi tự do do admin nhập — giữ nguyên, không cố phân tích.
    ...(profile.openingHours ? { openingHours: profile.openingHours } : {}),
  };
}

/**
 * `url` là URL canonical tuyệt đối của trang sản phẩm; ảnh tương đối được
 * ghép theo origin của nó. Chưa có `aggregateRating` cho tới khi có đánh giá thật.
 */
export function productJsonLd(
  product: JsonLdProduct,
  url: string,
  profile: PublicStoreProfile,
): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Product",
    name: product.name,
    description: `Sản phẩm ${product.name} tại ${profile.name}`,
    url,
    ...(product.imageUrl
      ? { image: [toAbsoluteUrl(product.imageUrl, url)] }
      : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(product.category ? { category: product.category.name } : {}),
    brand: { "@type": "Brand", name: profile.name },
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "VND",
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url,
    },
  };
}

export function breadcrumbJsonLd(items: readonly BreadcrumbItem[]): JsonLd {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Chuỗi an toàn cho `<script type="application/ld+json">`: escape `<` để dữ
 * liệu (tên sản phẩm, tên cửa hàng) không thể đóng thẻ script.
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

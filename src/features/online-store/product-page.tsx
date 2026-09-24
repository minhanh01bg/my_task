import type { Metadata } from "next";

import { JsonLdScript } from "@/components/seo/json-ld-script";
import { siteConfig } from "@/config/site";
import { productCrumbs, toBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { storefrontOpenGraph } from "@/lib/seo/open-graph";
import { productHref } from "@/lib/seo/product-href";
import type { ShippingSettings } from "@/lib/shipping/shipping-fee";
import type { OnlineProductDetail } from "@/server/catalog/get-product-detail";
import type { PublicStoreProfile } from "@/types/storefront";

import { OnlineCartProvider } from "./cart-context";
import { ProductDetailView } from "./product-detail-view";
import { StoreFooter } from "./store-footer";
import { StoreHeader } from "./store-header";

/**
 * Dùng chung cho `/shop/p/[slug]` (canonical) và `/shop/products/[id]` (URL
 * cũ, chỉ còn render khi sản phẩm chưa có slug). Canonical luôn là
 * `productHref(product)`.
 */
export function productPageMetadata(
  detail: OnlineProductDetail | null,
  storeProfile: PublicStoreProfile,
): Metadata {
  if (!detail) {
    return {
      title: "Sản phẩm không tồn tại",
      description: "Không tìm thấy sản phẩm yêu cầu tại cửa hàng.",
    };
  }

  const { product } = detail;
  const path = productHref(product);
  const url = `${siteConfig.url}${path}`;
  const description = `Mua ${product.name} chính hãng tại ${storeProfile.name}. Đặt nhanh trực tuyến, giao hàng tận nơi.`;

  return {
    // Template của shop/layout nối `| <tên cửa hàng trong DB>`.
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: storefrontOpenGraph({
      title: `${product.name} | ${storeProfile.name}`,
      description,
      url,
      siteName: storeProfile.name,
      // Không có ảnh sản phẩm → ảnh OG mặc định (storefrontOpenGraph).
      images: product.imageUrl
        ? [{ url: new URL(product.imageUrl, url).href, alt: product.name }]
        : undefined,
    }),
  };
}

export function ProductPage({
  detail,
  storeProfile,
  shipping,
}: {
  detail: OnlineProductDetail;
  storeProfile: PublicStoreProfile;
  /** `getShippingSettings()` — gio hang tren trang san pham dung dung phi ship. */
  shipping: ShippingSettings;
}) {
  const { product } = detail;
  const url = `${siteConfig.url}${productHref(product)}`;
  const jsonLd = [
    productJsonLd(product, url, storeProfile),
    breadcrumbJsonLd(toBreadcrumbItems(productCrumbs(product), siteConfig.url)),
  ];

  return (
    <OnlineCartProvider>
      <JsonLdScript data={jsonLd} />
      <StoreHeader storeName={storeProfile.name} shipping={shipping} />
      <main className="min-h-[70vh]">
        <ProductDetailView detail={detail} />
      </main>
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

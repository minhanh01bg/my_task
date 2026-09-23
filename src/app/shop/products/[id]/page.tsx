import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/seo/json-ld-script";
import { siteConfig } from "@/config/site";
import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { ProductDetailView } from "@/features/online-store/product-detail-view";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import { productCrumbs, toBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { storefrontOpenGraph } from "@/lib/seo/open-graph";
import { getOnlineProductDetail } from "@/server/catalog/get-product-detail";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

/** ISR: HTML không phụ thuộc cookie; tag cache (Task 4) lo invalidation. */
export const revalidate = 60;

/** Mảng rỗng: không prerender lúc build, render lần đầu khi có request rồi cache (ISR). */
export function generateStaticParams(): Array<{ id: string }> {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [detail, storeProfile] = await Promise.all([
    getOnlineProductDetail(id),
    getPublicStoreProfile(),
  ]);

  if (!detail) {
    return {
      title: "Sản phẩm không tồn tại",
      description: "Không tìm thấy sản phẩm yêu cầu tại cửa hàng.",
    };
  }

  const { product } = detail;
  const description = `Mua ${product.name} chính hãng tại ${storeProfile.name}. Đặt nhanh trực tuyến, giao hàng tận nơi.`;
  const url = `${siteConfig.url}/shop/products/${id}`;

  return {
    // Template của shop/layout nối `| <tên cửa hàng trong DB>`.
    title: product.name,
    description,
    alternates: {
      canonical: `/shop/products/${id}`,
    },
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

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Cùng loader `cache()` với generateMetadata → một truy vấn mỗi request.
  const [detail, storeProfile] = await Promise.all([
    getOnlineProductDetail(id),
    getPublicStoreProfile(),
  ]);

  if (!detail) {
    notFound();
  }

  const { product } = detail;
  const url = `${siteConfig.url}/shop/products/${id}`;
  const jsonLd = [
    productJsonLd(product, url, storeProfile),
    breadcrumbJsonLd(toBreadcrumbItems(productCrumbs(product), siteConfig.url)),
  ];

  return (
    <OnlineCartProvider>
      <JsonLdScript data={jsonLd} />
      <StoreHeader storeName={storeProfile.name} />
      <main className="min-h-[70vh]">
        <ProductDetailView detail={detail} />
      </main>
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

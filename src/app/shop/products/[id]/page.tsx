import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { siteConfig } from "@/config/site";
import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { ProductDetailView } from "@/features/online-store/product-detail-view";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOnlineProductDetail } from "@/server/catalog/get-product-detail";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

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
  const title = `${product.name} | ${storeProfile.name}`;
  const description = `Mua ${product.name} chính hãng tại ${storeProfile.name}. Đặt nhanh trực tuyến, giao hàng tận nơi.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/shop/products/${id}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/shop/products/${id}`,
      siteName: storeProfile.name,
      locale: "vi_VN",
      type: "website",
      ...(product.imageUrl ? { images: [{ url: product.imageUrl }] } : {}),
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, storeProfile, isAdmin, customerSession] = await Promise.all([
    getOnlineProductDetail(id),
    getPublicStoreProfile(),
    hasAdminSession(),
    getOptionalCustomerSession(),
  ]);

  if (!detail) {
    notFound();
  }

  const { product } = detail;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.imageUrl ? { image: product.imageUrl } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    description: `Sản phẩm ${product.name} tại ${storeProfile.name}`,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "VND",
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: `${siteConfig.url}/shop/products/${id}`,
    },
  };

  return (
    <OnlineCartProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <StoreHeader
        storeName={storeProfile.name}
        isAdmin={isAdmin}
        isCustomer={Boolean(customerSession)}
      />
      <main className="min-h-[70vh]">
        <ProductDetailView detail={detail} />
      </main>
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

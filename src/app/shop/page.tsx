import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";
import { CategorySection } from "@/features/online-store/landing/category-section";
import { FlashSaleSection } from "@/features/online-store/landing/flash-sale-section";
import { HeroSection } from "@/features/online-store/landing/hero-section";
import { ProductRail } from "@/features/online-store/landing/product-rail";
import { RecentlyViewedSection } from "@/features/online-store/recently-viewed";
import { TrustSection } from "@/features/online-store/landing/trust-section";
import { PromotionBanner } from "@/features/online-store/promotion-banner";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import { getPublicStoreProfile } from "@/server/settings/store-settings";
import { getActivePromotions } from "@/server/storefront/promotions";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const storeProfile = await getPublicStoreProfile();
  const title = `Cửa hàng trực tuyến | ${storeProfile.name}`;
  const description = `Mua sắm nhu yếu phẩm, thực phẩm và đồ tiêu dùng chính hãng tại ${storeProfile.name}. Đặt nhanh trực tuyến, giao hàng tận nơi.`;

  return {
    title,
    description,
    alternates: {
      canonical: "/shop",
    },
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/shop`,
      siteName: storeProfile.name,
      locale: "vi_VN",
      type: "website",
    },
  };
}

export default async function ShopPage() {
  const [
    catalog,
    storeProfile,
    isAdmin,
    announcements,
    heroPromotions,
    customerSession,
  ] = await Promise.all([
    getOnlineCatalog(),
    getPublicStoreProfile(),
    hasAdminSession(),
    getActivePromotions({ placement: "announcement", limit: 3 }),
    getActivePromotions({ placement: "hero", limit: 1 }),
    getOptionalCustomerSession(),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: storeProfile.name,
    description: "Cửa hàng bán lẻ trực tuyến chính hãng",
    url: `${siteConfig.url}/shop`,
    ...(storeProfile.hotline ? { telephone: storeProfile.hotline } : {}),
    ...(storeProfile.address ? { address: storeProfile.address } : {}),
    ...(storeProfile.openingHours
      ? { openingHours: storeProfile.openingHours }
      : {}),
  };

  return (
    <OnlineCartProvider>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PromotionBanner promotions={announcements} placement="announcement" />
      <StoreHeader
        storeName={storeProfile.name}
        isAdmin={isAdmin}
        isCustomer={Boolean(customerSession)}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <PromotionBanner promotions={heroPromotions} placement="hero" />
      </div>
      <HeroSection
        storeName={storeProfile.name}
        tagline="Hàng thiết yếu, đặt nhanh tại nhà"
        hotline={storeProfile.hotline}
      />
      <CategorySection categories={catalog.categories} />
      <FlashSaleSection products={catalog.products} />
      {catalog.products.length > 0 ? (
        <ProductRail
          title="Sản phẩm nổi bật"
          subtitle="Lựa chọn phổ biến được nhiều khách hàng tin tưởng"
          products={[...catalog.products]
            .filter((p) => p.stock > 0)
            .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
            .slice(0, 8)}
        />
      ) : null}
      <CatalogBrowser catalog={catalog} />
      <RecentlyViewedSection />
      <TrustSection
        storeName={storeProfile.name}
        hotline={storeProfile.hotline}
      />
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

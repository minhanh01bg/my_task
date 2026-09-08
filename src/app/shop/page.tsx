import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";
import { CategorySection } from "@/features/online-store/landing/category-section";
import { HeroSection } from "@/features/online-store/landing/hero-section";
import { ProductRail } from "@/features/online-store/landing/product-rail";
import { TrustSection } from "@/features/online-store/landing/trust-section";
import { PromotionBanner } from "@/features/online-store/promotion-banner";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getPublicStoreProfile } from "@/server/settings/store-settings";
import { getActivePromotions } from "@/server/storefront/promotions";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [catalog, storeProfile, isAdmin, announcements, heroPromotions] =
    await Promise.all([
      getOnlineCatalog(),
      getPublicStoreProfile(),
      hasAdminSession(),
      getActivePromotions({ placement: "announcement", limit: 3 }),
      getActivePromotions({ placement: "hero", limit: 1 }),
    ]);

  return (
    <OnlineCartProvider>
      <PromotionBanner promotions={announcements} placement="announcement" />
      <StoreHeader storeName={storeProfile.name} isAdmin={isAdmin} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <PromotionBanner promotions={heroPromotions} placement="hero" />
      </div>
      <HeroSection
        storeName={storeProfile.name}
        tagline="Hàng thiết yếu, đặt nhanh tại nhà"
        hotline={storeProfile.hotline}
      />
      <CategorySection categories={catalog.categories} />
      <ProductRail
        title="Sản phẩm nổi bật"
        subtitle="Lựa chọn được khách hàng quan tâm nhiều nhất"
        products={catalog.products}
      />
      <TrustSection
        storeName={storeProfile.name}
        hotline={storeProfile.hotline}
      />
      <CatalogBrowser catalog={catalog} />
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

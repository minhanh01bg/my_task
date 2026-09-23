import type { Metadata } from "next";

import { siteConfig, storeTitle } from "@/config/site";
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
import type { OnlineProduct } from "@/features/online-store/types";
import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getPublicStoreProfile } from "@/server/settings/store-settings";
import { getActivePromotions } from "@/server/storefront/promotions";

/** ISR: HTML không đọc cookie; phần phụ thuộc phiên nằm ở client island của header. */
export const revalidate = 60;

const FLASH_SALE_LIMIT = 4;
const FEATURED_LIMIT = 8;

/** DTO tối thiểu gửi xuống client — không để field thừa lọt vào RSC payload. */
function toCatalogProductDto(product: OnlineProduct): OnlineProduct {
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    unit: product.unit,
    stock: product.stock,
    imageUrl: product.imageUrl,
    categoryId: product.categoryId,
    soldCount: product.soldCount ?? 0,
    // Giữ: CatalogBrowser lọc/tìm kiếm bỏ dấu phía client.
    searchText: product.searchText,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const storeProfile = await getPublicStoreProfile();
  const pageTitle = "Cửa hàng trực tuyến";
  const description = `Mua sắm nhu yếu phẩm, thực phẩm và đồ tiêu dùng chính hãng tại ${storeProfile.name}. Đặt nhanh trực tuyến, giao hàng tận nơi.`;

  return {
    // Template gốc nối tên cửa hàng; chỉ dùng absolute khi tên DB khác cấu hình.
    title: storeTitle(pageTitle, storeProfile.name),
    description,
    alternates: {
      canonical: "/shop",
    },
    openGraph: {
      title: `${pageTitle} | ${storeProfile.name}`,
      description,
      url: `${siteConfig.url}/shop`,
      siteName: storeProfile.name,
      locale: "vi_VN",
      type: "website",
    },
  };
}

export default async function ShopPage() {
  const [catalog, storeProfile, announcements, heroPromotions] =
    await Promise.all([
      getOnlineCatalog(),
      getPublicStoreProfile(),
      getActivePromotions({ placement: "announcement", limit: 3 }),
      getActivePromotions({ placement: "hero", limit: 1 }),
    ]);

  const products = catalog.products.map(toCatalogProductDto);
  const flashSaleProducts = products
    .filter((p) => p.stock > 0)
    .slice(0, FLASH_SALE_LIMIT);
  const featuredProducts = products
    .filter((p) => p.stock > 0)
    .sort((a, b) => (b.soldCount ?? 0) - (a.soldCount ?? 0))
    .slice(0, FEATURED_LIMIT);

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
      <StoreHeader storeName={storeProfile.name} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <PromotionBanner promotions={heroPromotions} placement="hero" />
      </div>
      <HeroSection
        storeName={storeProfile.name}
        tagline="Hàng thiết yếu, đặt nhanh tại nhà"
        hotline={storeProfile.hotline}
      />
      <CategorySection categories={catalog.categories} />
      <FlashSaleSection products={flashSaleProducts} />
      {products.length > 0 ? (
        <ProductRail
          title="Sản phẩm nổi bật"
          subtitle="Lựa chọn phổ biến được nhiều khách hàng tin tưởng"
          products={featuredProducts}
        />
      ) : null}
      <CatalogBrowser catalog={{ categories: catalog.categories, products }} />
      <RecentlyViewedSection />
      <TrustSection
        storeName={storeProfile.name}
        hotline={storeProfile.hotline}
      />
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

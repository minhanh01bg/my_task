import { JsonLdScript } from "@/components/seo/json-ld-script";
import { siteConfig } from "@/config/site";
import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { StoreBreadcrumbs } from "@/features/online-store/store-breadcrumbs";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import { storefrontCrumbs, toBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import type { ShippingSettings } from "@/lib/shipping/shipping-fee";
import type { PublicStoreProfile } from "@/types/storefront";

export interface PolicyLayoutProps {
  storeProfile: PublicStoreProfile;
  /** `getShippingSettings()` — phí ship/ngưỡng freeship cho giỏ hàng ở header. */
  shipping: ShippingSettings;
  /** Đường dẫn canonical của trang, dùng cho breadcrumb. */
  path: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function PolicyLayout({
  storeProfile,
  shipping,
  path,
  title,
  description,
  children,
}: PolicyLayoutProps) {
  const crumbs = storefrontCrumbs({ name: title, path });

  return (
    <OnlineCartProvider>
      <JsonLdScript
        data={breadcrumbJsonLd(toBreadcrumbItems(crumbs, siteConfig.url))}
      />
      <StoreHeader storeName={storeProfile.name} shipping={shipping} />

      <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <StoreBreadcrumbs crumbs={crumbs} className="mb-6" />

        {/* Header section */}
        <header className="border-border/60 mb-8 border-b pb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            {description}
          </p>
          <p className="text-muted-foreground/80 mt-2 text-xs">
            Cập nhật lần cuối: Tháng 09/2026 • Áp dụng tại {storeProfile.name}
          </p>
        </header>

        {/* Content body */}
        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          {children}
        </article>
      </main>

      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

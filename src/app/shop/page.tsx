import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [catalog, storeProfile, isAdmin] = await Promise.all([
    getOnlineCatalog(),
    getPublicStoreProfile(),
    hasAdminSession(),
  ]);
  return (
    <OnlineCartProvider>
      <StoreHeader storeName={storeProfile.name} isAdmin={isAdmin} />
      <CatalogBrowser catalog={catalog} />
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}

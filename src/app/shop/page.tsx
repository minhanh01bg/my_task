import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";
import { StoreHeader } from "@/features/online-store/store-header";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getStoreName } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [catalog, storeName, isAdmin] = await Promise.all([
    getOnlineCatalog(),
    getStoreName(),
    hasAdminSession(),
  ]);
  return (
    <OnlineCartProvider>
      <StoreHeader storeName={storeName} isAdmin={isAdmin} />
      <CatalogBrowser catalog={catalog} />
    </OnlineCartProvider>
  );
}

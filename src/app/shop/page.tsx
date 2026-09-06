import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";
import { StoreHeader } from "@/features/online-store/store-header";
import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getStoreName } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const [catalog, storeName] = await Promise.all([
    getOnlineCatalog(),
    getStoreName(),
  ]);
  return (
    <OnlineCartProvider>
      <StoreHeader storeName={storeName} />
      <CatalogBrowser catalog={catalog} />
    </OnlineCartProvider>
  );
}

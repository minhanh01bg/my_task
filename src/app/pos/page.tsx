import { PosScreen } from "@/components/pos/pos-screen";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import { getPosCatalog } from "@/server/catalog/get-pos-catalog";
import {
  getStoreBankAccount,
  getStoreName,
} from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

/**
 * Server Component nap toan bo danh muc mot lan roi truyen xuong client.
 * Tim kiem sau do chay hoan toan trong bo nho trinh duyet.
 */
export default async function PosPage() {
  await requireAdminSession({ redirectToLogin: true });

  const [catalog, bankAccount, storeName] = await Promise.all([
    getPosCatalog(),
    getStoreBankAccount(),
    getStoreName(),
  ]);

  return (
    <PosScreen
      catalog={catalog}
      bankAccount={bankAccount}
      storeName={storeName}
    />
  );
}

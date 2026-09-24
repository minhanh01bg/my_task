import { PageHeader } from "@/components/kit";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  getPublicStoreProfile,
  getShippingSettings,
  getStoreBankAccount,
} from "@/server/settings/store-settings";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminSession({ redirectToLogin: true });

  const [storeProfile, account, shipping] = await Promise.all([
    getPublicStoreProfile(),
    getStoreBankAccount(),
    getShippingSettings(),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="Cài đặt"
        description="Thông tin cửa hàng online, phí giao hàng và tài khoản ngân hàng nhận chuyển khoản."
      />

      <SettingsForm
        storeProfile={storeProfile}
        account={account}
        shipping={shipping}
      />
    </div>
  );
}

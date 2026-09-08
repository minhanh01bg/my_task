import { PageHeader } from "@/components/kit";
import {
  getPublicStoreProfile,
  getStoreBankAccount,
} from "@/server/settings/store-settings";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [storeProfile, account] = await Promise.all([
    getPublicStoreProfile(),
    getStoreBankAccount(),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="Cài đặt"
        description="Thông tin cửa hàng online và tài khoản ngân hàng nhận chuyển khoản."
      />

      <SettingsForm storeProfile={storeProfile} account={account} />
    </div>
  );
}

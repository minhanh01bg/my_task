import { PageHeader } from "@/components/kit";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  getPublicStoreProfile,
  getStoreBankAccount,
} from "@/server/settings/store-settings";

import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminSession({ redirectToLogin: true });

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

import { Button } from "@/components/ui/button";
import {
  getStoreBankAccount,
  getStoreName,
} from "@/server/settings/store-settings";

import { saveSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [storeName, account] = await Promise.all([
    getStoreName(),
    getStoreBankAccount(),
  ]);

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Cài đặt</h1>

      <form action={saveSettingsAction} className="space-y-4">
        <label className="block">
          <span className="text-sm text-muted-foreground">Tên cửa hàng</span>
          <input
            name="storeName"
            defaultValue={storeName}
            className="mt-1 w-full rounded border px-4 py-3"
          />
        </label>

        <fieldset className="space-y-3 rounded-lg border p-4">
          <legend className="px-2 text-sm font-medium">
            Tài khoản nhận chuyển khoản
          </legend>

          <label className="block">
            <span className="text-sm text-muted-foreground">
              Mã ngân hàng (BIN, 6 chữ số)
            </span>
            <input
              name="bankBin"
              defaultValue={account?.bankBin ?? ""}
              placeholder="VD: 970423"
              className="mt-1 w-full rounded border px-4 py-3"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">Số tài khoản</span>
            <input
              name="accountNumber"
              defaultValue={account?.accountNumber ?? ""}
              className="mt-1 w-full rounded border px-4 py-3"
            />
          </label>

          <label className="block">
            <span className="text-sm text-muted-foreground">
              Tên chủ tài khoản (không dấu)
            </span>
            <input
              name="accountName"
              defaultValue={account?.accountName ?? ""}
              placeholder="NGUYEN VAN A"
              className="mt-1 w-full rounded border px-4 py-3"
            />
          </label>
        </fieldset>

        <Button type="submit">Lưu cài đặt</Button>
      </form>
    </div>
  );
}

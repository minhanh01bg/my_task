import { PageHeader } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <PageHeader
        title="Cài đặt"
        description="Thông tin ngân hàng dùng để sinh mã QR khi khách chuyển khoản."
      />

      <form action={saveSettingsAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Cửa hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <Label htmlFor="store-name">Tên cửa hàng</Label>
            <Input id="store-name" name="storeName" defaultValue={storeName} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tài khoản nhận chuyển khoản</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bank-bin">Mã ngân hàng (BIN, 6 chữ số)</Label>
              <Input
                id="bank-bin"
                name="bankBin"
                defaultValue={account?.bankBin ?? ""}
                placeholder="VD: 970423"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank-account-number">Số tài khoản</Label>
              <Input
                id="bank-account-number"
                name="accountNumber"
                defaultValue={account?.accountNumber ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bank-account-name">
                Tên chủ tài khoản (không dấu)
              </Label>
              <Input
                id="bank-account-name"
                name="accountName"
                defaultValue={account?.accountName ?? ""}
                placeholder="NGUYEN VAN A"
              />
            </div>
          </CardContent>
        </Card>

        <Button type="submit">Lưu cài đặt</Button>
      </form>
    </div>
  );
}

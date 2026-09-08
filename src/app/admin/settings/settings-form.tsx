"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BankAccount } from "@/lib/vietqr/types";
import type { PublicStoreProfile } from "@/types/storefront";

import { saveSettingsAction, type SaveSettingsResult } from "./actions";

interface SettingsFormProps {
  storeProfile: PublicStoreProfile;
  account: BankAccount | null;
}

export function SettingsForm({ storeProfile, account }: SettingsFormProps) {
  const [state, formAction, pending] = useActionState<
    SaveSettingsResult | null,
    FormData
  >(saveSettingsAction, null);

  return (
    <form action={formAction} className="space-y-6">
      {state ? (
        state.ok ? (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300"
          >
            ✓ {state.message}
          </div>
        ) : (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-4 text-sm font-medium"
          >
            ✕ {state.error}
          </div>
        )
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin cửa hàng online</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="store-name">
              Tên cửa hàng <span className="text-destructive">*</span>
            </Label>
            <Input
              id="store-name"
              name="storeName"
              required
              defaultValue={storeProfile.name}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-hotline">Số điện thoại / Hotline</Label>
            <Input
              id="store-hotline"
              name="hotline"
              defaultValue={storeProfile.hotline ?? ""}
              placeholder="VD: 0901234567"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-address">Địa chỉ cửa hàng (nhận hàng)</Label>
            <Input
              id="store-address"
              name="address"
              defaultValue={storeProfile.address ?? ""}
              placeholder="VD: 123 Lê Lợi, Quận 1, TP. Hồ Chí Minh"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-opening-hours">Giờ mở cửa / nhận hàng</Label>
            <Input
              id="store-opening-hours"
              name="openingHours"
              defaultValue={storeProfile.openingHours ?? ""}
              placeholder="VD: 08:00 - 21:00 hàng ngày"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="store-map-url">
              Đường dẫn bản đồ Google Maps (HTTPS)
            </Label>
            <Input
              id="store-map-url"
              name="mapUrl"
              type="url"
              defaultValue={storeProfile.mapUrl ?? ""}
              placeholder="VD: https://maps.google.com/?q=..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tài khoản nhận chuyển khoản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bank-bin">
              Mã ngân hàng (BIN, 6 chữ số){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bank-bin"
              name="bankBin"
              required
              defaultValue={account?.bankBin ?? ""}
              placeholder="VD: 970423"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bank-account-number">
              Số tài khoản <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bank-account-number"
              name="accountNumber"
              required
              defaultValue={account?.accountNumber ?? ""}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bank-account-name">
              Tên chủ tài khoản (không dấu){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bank-account-name"
              name="accountName"
              required
              defaultValue={account?.accountName ?? ""}
              placeholder="NGUYEN VAN A"
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "Đang lưu cài đặt…" : "Lưu cài đặt"}
      </Button>
    </form>
  );
}

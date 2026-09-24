"use server";

import { revalidatePath } from "next/cache";

import { expirePublicNow } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import {
  saveShippingSettings,
  saveStoreBankAccount,
  saveStoreProfile,
} from "@/server/settings/store-settings";
import { logAdminAction } from "@/server/auth/admin-audit";
import {
  AdminUnauthorizedError,
  requireAdminSession,
} from "@/server/auth/require-admin-session";
import { adminSettingsSchema, type AdminSettingsInput } from "@/types/settings";

export type { AdminSettingsInput };

export type SaveSettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function saveSettingsAction(
  _prevState: unknown,
  formData: FormData,
): Promise<SaveSettingsResult> {
  let adminIdentity: { id: string } | undefined;
  try {
    const session = await requireAdminSession();
    adminIdentity = session.identity;
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return {
        ok: false,
        error: "Yêu cầu quyền quản trị để thay đổi cài đặt",
      };
    }
    throw error;
  }

  const raw = {
    storeName: formData.get("storeName"),
    hotline: formData.get("hotline") || undefined,
    address: formData.get("address") || undefined,
    openingHours: formData.get("openingHours") || undefined,
    mapUrl: formData.get("mapUrl") || undefined,
    bankBin: formData.get("bankBin"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
    shippingFee: formData.get("shippingFee") ?? undefined,
    freeShippingThreshold: formData.get("freeShippingThreshold") ?? undefined,
  };

  const parsed = adminSettingsSchema.safeParse(raw);

  if (!parsed.success) {
    const errorMsg =
      parsed.error.issues[0]?.message ?? "Thông tin cài đặt không hợp lệ";
    return { ok: false, error: errorMsg };
  }

  // Hai o phi ship di cung nhau: thieu mot o thi khong luu gi ca.
  const { shippingFee, freeShippingThreshold } = parsed.data;
  if ((shippingFee === undefined) !== (freeShippingThreshold === undefined)) {
    return {
      ok: false,
      error: "Nhập đủ cả phí giao hàng và ngưỡng miễn phí giao hàng",
    };
  }

  await saveStoreProfile({
    name: parsed.data.storeName,
    hotline: parsed.data.hotline,
    address: parsed.data.address,
    openingHours: parsed.data.openingHours,
    mapUrl: parsed.data.mapUrl,
  });

  await saveStoreBankAccount({
    bankBin: parsed.data.bankBin,
    accountNumber: parsed.data.accountNumber,
    accountName: parsed.data.accountName,
  });

  if (shippingFee !== undefined && freeShippingThreshold !== undefined) {
    await saveShippingSettings({ shippingFee, freeShippingThreshold });
  }

  await logAdminAction({
    identityId: adminIdentity?.id,
    action: "settings.update",
    entityType: "store_settings",
    entityId: "store",
    metadata: {
      storeName: parsed.data.storeName,
      bankBin: parsed.data.bankBin,
      accountName: parsed.data.accountName,
      shippingFee,
      freeShippingThreshold,
    },
  });

  // save* da danh dau stale (SWR); trang cai dat doc lai profile qua loader
  // co cache nen het han ngay de form khong hien gia tri cu sau khi luu.
  expirePublicNow(CACHE_TAGS.settings);
  revalidatePath("/admin/settings");
  revalidatePath("/pos");
  revalidatePath("/shop");

  return { ok: true, message: "Lưu cài đặt thành công" };
}

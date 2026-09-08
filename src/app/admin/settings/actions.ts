"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  saveStoreBankAccount,
  saveStoreProfile,
} from "@/server/settings/store-settings";

export const adminSettingsSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(1, "Tên cửa hàng không được để trống")
    .max(100),
  hotline: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((val) => val || undefined)
    .refine((val) => !val || (val.length >= 8 && /^[0-9+\s().-]+$/.test(val)), {
      message: "Số hotline không hợp lệ (từ 8-20 ký tự)",
    }),
  address: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((val) => val || undefined),
  openingHours: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((val) => val || undefined),
  mapUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((val) => val || undefined)
    .refine(
      (val) => {
        if (!val) return true;
        if (!val.startsWith("https://")) return false;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: "mapUrl phải là URL HTTPS an toàn" },
    ),
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng phải là 6 chữ số"),
  accountNumber: z.string().trim().min(1, "Số tài khoản không được để trống"),
  accountName: z.string().trim().min(1, "Tên tài khoản không được để trống"),
});

export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;

export type SaveSettingsResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function saveSettingsAction(
  _prevState: unknown,
  formData: FormData,
): Promise<SaveSettingsResult> {
  const raw = {
    storeName: formData.get("storeName"),
    hotline: formData.get("hotline") || undefined,
    address: formData.get("address") || undefined,
    openingHours: formData.get("openingHours") || undefined,
    mapUrl: formData.get("mapUrl") || undefined,
    bankBin: formData.get("bankBin"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  };

  const parsed = adminSettingsSchema.safeParse(raw);

  if (!parsed.success) {
    const errorMsg =
      parsed.error.issues[0]?.message ?? "Thông tin cài đặt không hợp lệ";
    return { ok: false, error: errorMsg };
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

  revalidatePath("/admin/settings");
  revalidatePath("/pos");
  revalidatePath("/shop");

  return { ok: true, message: "Lưu cài đặt thành công" };
}

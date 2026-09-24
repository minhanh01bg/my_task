"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

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

/** Tien VND so nguyen >= 0; o trong = giu nguyen gia tri dang luu. */
const optionalMoney = (label: string) =>
  z
    .union([z.literal(""), z.undefined(), z.null(), z.coerce.number()])
    .transform((value) =>
      value === "" || value === null || value === undefined ? undefined : value,
    )
    .pipe(
      z
        .number({ message: `${label} không hợp lệ` })
        .int(`${label} phải là số nguyên`)
        .min(0, `${label} không được âm`)
        .max(100_000_000, `${label} quá lớn`)
        .optional(),
    );

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
  shippingFee: optionalMoney("Phí giao hàng"),
  freeShippingThreshold: optionalMoney("Ngưỡng miễn phí giao hàng"),
});

export type AdminSettingsInput = z.infer<typeof adminSettingsSchema>;

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

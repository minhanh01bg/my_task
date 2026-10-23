"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logger } from "@/lib/logger";
import type { BankAccount } from "@/lib/vietqr/types";
import { expirePublicNow } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import {
  createBankAccountChangedNotification,
  isBankAccountChanged,
  maskAccountNumber,
} from "@/server/settings/bank-account-change";
import { verifyOwnerPassword } from "@/server/settings/owner-password";
import {
  readStoreBankFields,
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

const ownerPasswordSchema = z.string().max(256).optional();

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

  const ownerPassword = ownerPasswordSchema.safeParse(
    formData.get("ownerPassword") || undefined,
  );
  if (!ownerPassword.success) {
    return { ok: false, error: "Mật khẩu chủ cửa hàng không hợp lệ." };
  }

  // Hai o phi ship di cung nhau: thieu mot o thi khong luu gi ca.
  const { shippingFee, freeShippingThreshold } = parsed.data;
  if ((shippingFee === undefined) !== (freeShippingThreshold === undefined)) {
    return {
      ok: false,
      error: "Nhập đủ cả phí giao hàng và ngưỡng miễn phí giao hàng",
    };
  }

  // Doi noi nhan tien (VietQR) can mat khau chu; giu nguyen thi khong ghi lai.
  // Xac minh (PBKDF2) chay ngoai transaction de khong giu khoa SQLite.
  const bankAccount: BankAccount = {
    bankBin: parsed.data.bankBin,
    accountNumber: parsed.data.accountNumber,
    accountName: parsed.data.accountName,
  };
  const currentBankAccount = await readStoreBankFields();
  const bankAccountChanged = isBankAccountChanged(
    currentBankAccount,
    bankAccount,
  );
  if (bankAccountChanged) {
    const ownerCheck = await verifyOwnerPassword(
      ownerPassword.data,
      adminIdentity?.id,
    );
    if (!ownerCheck.ok) {
      await logAdminAction({
        identityId: adminIdentity?.id,
        action: "settings.bank_account.denied",
        entityType: "store_settings",
        entityId: "store",
        metadata: { reason: ownerCheck.reason },
      });
      return { ok: false, error: ownerCheck.message };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await saveStoreProfile(
        {
          name: parsed.data.storeName,
          hotline: parsed.data.hotline,
          address: parsed.data.address,
          openingHours: parsed.data.openingHours,
          mapUrl: parsed.data.mapUrl,
        },
        tx,
      );

      if (bankAccountChanged) {
        await saveStoreBankAccount(bankAccount, tx);
        await createBankAccountChangedNotification(
          tx,
          currentBankAccount,
          bankAccount,
        );
      }

      if (shippingFee !== undefined && freeShippingThreshold !== undefined) {
        await saveShippingSettings({ shippingFee, freeShippingThreshold }, tx);
      }
    });
  } catch (error) {
    const correlationId = crypto.randomUUID();
    logger.error("settings_save_failed", {
      correlationId,
      errorClass:
        error instanceof Error ? error.constructor.name : typeof error,
    });
    return {
      ok: false,
      error: "Không thể lưu cài đặt lúc này. Vui lòng thử lại.",
    };
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
      bankAccountChanged,
      shippingFee,
      freeShippingThreshold,
    },
  });

  if (bankAccountChanged) {
    await logAdminAction({
      identityId: adminIdentity?.id,
      action: "settings.bank_account.update",
      entityType: "store_settings",
      entityId: "store",
      metadata: {
        bankBinBefore: currentBankAccount.bankBin ?? null,
        bankBin: bankAccount.bankBin,
        accountNumberBefore: maskAccountNumber(
          currentBankAccount.accountNumber,
        ),
        accountNumber: maskAccountNumber(bankAccount.accountNumber),
      },
    });
  }

  // save* da danh dau stale (SWR); trang cai dat doc lai profile qua loader
  // co cache nen het han ngay de form khong hien gia tri cu sau khi luu.
  expirePublicNow(CACHE_TAGS.settings);
  revalidatePath("/admin/settings");
  revalidatePath("/pos");
  revalidatePath("/shop");

  return { ok: true, message: "Lưu cài đặt thành công" };
}

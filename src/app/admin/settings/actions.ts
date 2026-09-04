"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  saveStoreBankAccount,
  saveStoreName,
} from "@/server/settings/store-settings";

const schema = z.object({
  storeName: z.string().min(1),
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng phải là 6 chữ số"),
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
});

export async function saveSettingsAction(formData: FormData) {
  const parsed = schema.safeParse({
    storeName: formData.get("storeName"),
    bankBin: formData.get("bankBin"),
    accountNumber: formData.get("accountNumber"),
    accountName: formData.get("accountName"),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
    };
  }

  await saveStoreName(parsed.data.storeName);
  await saveStoreBankAccount({
    bankBin: parsed.data.bankBin,
    accountNumber: parsed.data.accountNumber,
    accountName: parsed.data.accountName,
  });

  revalidatePath("/admin/settings");
  revalidatePath("/pos");

  return { ok: true as const };
}

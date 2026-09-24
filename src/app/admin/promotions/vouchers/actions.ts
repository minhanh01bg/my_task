"use server";

import { revalidatePath } from "next/cache";

import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  createVoucher,
  deleteVoucher,
  toggleVoucher,
  updateVoucher,
} from "@/server/vouchers/admin-vouchers";
import { voucherInputSchema, type VoucherActionResult } from "@/types/voucher";

const VOUCHERS_PATH = "/admin/promotions/vouchers";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ngoai request context cua Next (vd. unit test)
  }
}

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** NumberStepper luon gui so: "0" nghia la khong gioi han. */
function optionalLimit(formData: FormData, name: string): string {
  const value = field(formData, name)?.trim() ?? "";
  return value === "0" ? "" : value;
}

export async function saveVoucherAction(
  _prevState: unknown,
  formData: FormData,
): Promise<VoucherActionResult> {
  const { identity } = await requireAdminSession();

  const isActive = field(formData, "isActive");
  const parsed = voucherInputSchema.safeParse({
    code: field(formData, "code") ?? "",
    type: field(formData, "type"),
    value: field(formData, "value") || 0,
    maxDiscount: optionalLimit(formData, "maxDiscount"),
    minOrderTotal: field(formData, "minOrderTotal") || 0,
    maxUses: optionalLimit(formData, "maxUses"),
    startsAt: field(formData, "startsAt"),
    endsAt: field(formData, "endsAt"),
    isActive: isActive === "true" || isActive === "on",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Thông tin mã giảm giá không hợp lệ",
    };
  }

  const id = field(formData, "id")?.trim();
  const actor = { identityId: identity?.id };
  const result = id
    ? await updateVoucher(id, parsed.data, actor)
    : await createVoucher(parsed.data, actor);

  if (result.ok) safeRevalidatePath(VOUCHERS_PATH);
  return result;
}

export async function toggleVoucherActiveAction(
  id: string,
  isActive: boolean,
): Promise<VoucherActionResult> {
  const { identity } = await requireAdminSession();
  const result = await toggleVoucher(id, isActive, {
    identityId: identity?.id,
  });
  if (result.ok) safeRevalidatePath(VOUCHERS_PATH);
  return result;
}

export async function deleteVoucherAction(
  id: string,
): Promise<VoucherActionResult> {
  const { identity } = await requireAdminSession();
  const result = await deleteVoucher(id, { identityId: identity?.id });
  if (result.ok) safeRevalidatePath(VOUCHERS_PATH);
  return result;
}

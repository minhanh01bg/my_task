"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ADMIN_UNAUTHORIZED_MESSAGE,
  adminEntityIdSchema,
  authorizeAdminAction,
  INVALID_INPUT_MESSAGE,
} from "@/server/admin/admin-action";
import {
  createVoucher,
  deleteVoucher,
  toggleVoucher,
  updateVoucher,
} from "@/server/vouchers/admin-vouchers";
import { voucherInputSchema, type VoucherActionResult } from "@/types/voucher";

const VOUCHERS_PATH = "/admin/promotions/vouchers";

const UNAUTHORIZED: VoucherActionResult = {
  ok: false,
  error: ADMIN_UNAUTHORIZED_MESSAGE,
};
const INVALID_INPUT: VoucherActionResult = {
  ok: false,
  error: INVALID_INPUT_MESSAGE,
};

const toggleSchema = z.object({
  id: adminEntityIdSchema,
  isActive: z.boolean(),
});

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
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const { identity } = session;

  // Khong co truong id = tao moi; co id thi phai la id hop le.
  const rawId = formData.get("id");
  const parsedId = rawId === null ? null : adminEntityIdSchema.safeParse(rawId);
  if (parsedId && !parsedId.success) return INVALID_INPUT;

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

  const actor = { identityId: identity?.id };
  const result = parsedId
    ? await updateVoucher(parsedId.data, parsed.data, actor)
    : await createVoucher(parsed.data, actor);

  if (result.ok) safeRevalidatePath(VOUCHERS_PATH);
  return result;
}

export async function toggleVoucherActiveAction(
  id: string,
  isActive: boolean,
): Promise<VoucherActionResult> {
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const { identity } = session;

  const parsed = toggleSchema.safeParse({ id, isActive });
  if (!parsed.success) return INVALID_INPUT;

  const result = await toggleVoucher(parsed.data.id, parsed.data.isActive, {
    identityId: identity?.id,
  });
  if (result.ok) safeRevalidatePath(VOUCHERS_PATH);
  return result;
}

export async function deleteVoucherAction(
  id: string,
): Promise<VoucherActionResult> {
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const { identity } = session;

  const parsedId = adminEntityIdSchema.safeParse(id);
  if (!parsedId.success) return INVALID_INPUT;

  const result = await deleteVoucher(parsedId.data, {
    identityId: identity?.id,
  });
  if (result.ok) safeRevalidatePath(VOUCHERS_PATH);
  return result;
}

"use server";

import { revalidatePath } from "next/cache";

import { logAdminAction } from "@/server/auth/admin-audit";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";
import { promotionActionSchema } from "@/types/storefront";
import type { PromotionActionResult } from "@/types/storefront";

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ignore when called outside of Next.js request context (e.g. unit tests)
  }
}

export async function savePromotionAction(
  _prevState: unknown,
  formData: FormData,
): Promise<PromotionActionResult> {
  const { identity } = await requireAdminSession();

  const raw = {
    id: (formData.get("id") as string) || undefined,
    title: formData.get("title"),
    body: (formData.get("body") as string) || undefined,
    imageUrl: (formData.get("imageUrl") as string) || undefined,
    ctaLabel: (formData.get("ctaLabel") as string) || undefined,
    ctaHref: (formData.get("ctaHref") as string) || undefined,
    placement: formData.get("placement") || "announcement",
    startsAt: (formData.get("startsAt") as string) || undefined,
    endsAt: (formData.get("endsAt") as string) || undefined,
    priority: formData.get("priority") || 0,
    isActive:
      formData.get("isActive") === "true" || formData.get("isActive") === "on",
  };

  const parsed = promotionActionSchema.safeParse(raw);
  if (!parsed.success) {
    const errorMsg =
      parsed.error.issues[0]?.message ?? "Thông tin khuyến mãi không hợp lệ";
    return { ok: false, error: errorMsg };
  }

  const { id, ...data } = parsed.data;

  if (id) {
    const updated = await prisma.storefrontPromotion.update({
      where: { id },
      data,
    });

    await logAdminAction({
      identityId: identity?.id,
      action: "promotion.update",
      entityType: "promotion",
      entityId: id,
      metadata: { title: data.title },
    });

    safeRevalidatePath("/admin/promotions");
    safeRevalidatePath("/shop");

    return {
      ok: true,
      message: "Cập nhật chiến dịch khuyến mãi thành công",
      promotionId: updated.id,
    };
  }

  const created = await prisma.storefrontPromotion.create({
    data,
  });

  await logAdminAction({
    identityId: identity?.id,
    action: "promotion.create",
    entityType: "promotion",
    entityId: created.id,
    metadata: { title: data.title },
  });

  safeRevalidatePath("/admin/promotions");
  safeRevalidatePath("/shop");

  return {
    ok: true,
    message: "Tạo chiến dịch khuyến mãi thành công",
    promotionId: created.id,
  };
}

export async function togglePromotionActiveAction(
  id: string,
  isActive: boolean,
): Promise<PromotionActionResult> {
  const { identity } = await requireAdminSession();

  await prisma.storefrontPromotion.update({
    where: { id },
    data: { isActive },
  });

  await logAdminAction({
    identityId: identity?.id,
    action: "promotion.toggle",
    entityType: "promotion",
    entityId: id,
    metadata: { isActive },
  });

  safeRevalidatePath("/admin/promotions");
  safeRevalidatePath("/shop");

  return {
    ok: true,
    message: isActive ? "Đã bật khuyến mãi" : "Đã tạm dừng khuyến mãi",
  };
}

export async function deletePromotionAction(
  id: string,
): Promise<PromotionActionResult> {
  const { identity } = await requireAdminSession();

  await prisma.storefrontPromotion.delete({
    where: { id },
  });

  await logAdminAction({
    identityId: identity?.id,
    action: "promotion.delete",
    entityType: "promotion",
    entityId: id,
  });

  safeRevalidatePath("/admin/promotions");
  safeRevalidatePath("/shop");

  return {
    ok: true,
    message: "Đã xóa chiến dịch khuyến mãi",
  };
}

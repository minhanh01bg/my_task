"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ADMIN_UNAUTHORIZED_MESSAGE,
  adminEntityIdSchema,
  authorizeAdminAction,
  INVALID_INPUT_MESSAGE,
  isRecordNotFound,
} from "@/server/admin/admin-action";
import { logAdminAction } from "@/server/auth/admin-audit";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import { promotionActionSchema } from "@/types/storefront";
import type { PromotionActionResult } from "@/types/storefront";

const UNAUTHORIZED: PromotionActionResult = {
  ok: false,
  error: ADMIN_UNAUTHORIZED_MESSAGE,
};
const INVALID_INPUT: PromotionActionResult = {
  ok: false,
  error: INVALID_INPUT_MESSAGE,
};
const NOT_FOUND: PromotionActionResult = {
  ok: false,
  error: "Không tìm thấy chiến dịch khuyến mãi",
};

const toggleSchema = z.object({
  id: adminEntityIdSchema,
  isActive: z.boolean(),
});

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
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const { identity } = session;

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
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string" && !fieldErrors[field])
        fieldErrors[field] = issue.message;
    }
    return { ok: false, error: errorMsg, fieldErrors };
  }

  const { id, ...data } = parsed.data;

  if (id) {
    try {
      await prisma.storefrontPromotion.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (isRecordNotFound(error)) return NOT_FOUND;
      throw error;
    }

    await logAdminAction({
      identityId: identity?.id,
      action: "promotion.update",
      entityType: "promotion",
      entityId: id,
      metadata: { title: data.title },
    });

    revalidatePublic(CACHE_TAGS.promotions);
    safeRevalidatePath("/admin/promotions");
    safeRevalidatePath("/shop");

    return {
      ok: true,
      message: "Cập nhật chiến dịch khuyến mãi thành công",
      promotionId: id,
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

  revalidatePublic(CACHE_TAGS.promotions);
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
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const { identity } = session;

  const parsed = toggleSchema.safeParse({ id, isActive });
  if (!parsed.success) return INVALID_INPUT;

  try {
    await prisma.storefrontPromotion.update({
      where: { id: parsed.data.id },
      data: { isActive: parsed.data.isActive },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return NOT_FOUND;
    throw error;
  }

  await logAdminAction({
    identityId: identity?.id,
    action: "promotion.toggle",
    entityType: "promotion",
    entityId: parsed.data.id,
    metadata: { isActive: parsed.data.isActive },
  });

  revalidatePublic(CACHE_TAGS.promotions);
  safeRevalidatePath("/admin/promotions");
  safeRevalidatePath("/shop");

  return {
    ok: true,
    message: parsed.data.isActive
      ? "Đã bật khuyến mãi"
      : "Đã tạm dừng khuyến mãi",
  };
}

export async function deletePromotionAction(
  id: string,
): Promise<PromotionActionResult> {
  const session = await authorizeAdminAction();
  if (!session) return UNAUTHORIZED;
  const { identity } = session;

  const parsedId = adminEntityIdSchema.safeParse(id);
  if (!parsedId.success) return INVALID_INPUT;

  try {
    await prisma.storefrontPromotion.delete({
      where: { id: parsedId.data },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return NOT_FOUND;
    throw error;
  }

  await logAdminAction({
    identityId: identity?.id,
    action: "promotion.delete",
    entityType: "promotion",
    entityId: parsedId.data,
  });

  revalidatePublic(CACHE_TAGS.promotions);
  safeRevalidatePath("/admin/promotions");
  safeRevalidatePath("/shop");

  return {
    ok: true,
    message: "Đã xóa chiến dịch khuyến mãi",
  };
}

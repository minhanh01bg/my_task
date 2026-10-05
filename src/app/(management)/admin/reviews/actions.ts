"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  deleteReview,
  setReviewStatus,
  type ReviewActionResult,
} from "@/server/reviews/admin-reviews";
import { REVIEW_STATUSES } from "@/types/review";

const REVIEWS_PATH = "/admin/reviews";

const reviewIdSchema = z.string().trim().min(1).max(64);
const reviewStatusSchema = z.enum(REVIEW_STATUSES);

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Ngoai request context cua Next (vd. unit test)
  }
}

export async function setReviewStatusAction(
  id: string,
  status: string,
): Promise<ReviewActionResult> {
  const { identity } = await requireAdminSession();
  const parsedId = reviewIdSchema.safeParse(id);
  const parsedStatus = reviewStatusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { ok: false, error: "Yêu cầu không hợp lệ" };
  }
  const result = await setReviewStatus(parsedId.data, parsedStatus.data, {
    identityId: identity?.id,
  });
  if (result.ok) safeRevalidatePath(REVIEWS_PATH);
  return result;
}

export async function deleteReviewAction(
  id: string,
): Promise<ReviewActionResult> {
  const { identity } = await requireAdminSession();
  const parsedId = reviewIdSchema.safeParse(id);
  if (!parsedId.success) return { ok: false, error: "Yêu cầu không hợp lệ" };
  const result = await deleteReview(parsedId.data, {
    identityId: identity?.id,
  });
  if (result.ok) safeRevalidatePath(REVIEWS_PATH);
  return result;
}

import { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  AdminUnauthorizedError,
  requireAdminSession,
} from "@/server/auth/require-admin-session";

export const ADMIN_UNAUTHORIZED_MESSAGE = "Yêu cầu quyền quản trị";
export const INVALID_INPUT_MESSAGE = "Dữ liệu không hợp lệ";

/** Id bản ghi do client gửi lên server action (cuid, có giới hạn độ dài). */
export const adminEntityIdSchema = z.string().trim().min(1).max(64);

/**
 * Cổng quyền cho server action: trả phiên admin, hoặc null khi chưa đăng nhập
 * để action trả `{ ok: false }` thay vì ném lỗi ra client. Lỗi khác ném lại.
 */
export async function authorizeAdminAction(): Promise<Awaited<
  ReturnType<typeof requireAdminSession>
> | null> {
  try {
    return await requireAdminSession();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) return null;
    throw error;
  }
}

/** P2025: bản ghi cần sửa/xoá không còn tồn tại. */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  );
}

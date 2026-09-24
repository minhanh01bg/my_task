import { Prisma, type Voucher } from "@prisma/client";

import { paginate, type PageResult } from "@/server/admin/pagination";
import { logAdminAction } from "@/server/auth/admin-audit";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import type { VoucherActionResult, VoucherInput } from "@/types/voucher";

export const VOUCHERS_PAGE_SIZE = 20;

export interface VoucherActor {
  identityId?: string;
}

const NOT_FOUND: VoucherActionResult = {
  ok: false,
  error: "Không tìm thấy mã giảm giá",
};

function isKnownError(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function auditMetadata(input: VoucherInput): Record<string, unknown> {
  return {
    code: input.code,
    type: input.type,
    value: input.value,
    maxUses: input.maxUses,
    isActive: input.isActive,
  };
}

export function listVouchers(query: {
  page?: number;
  pageSize?: number;
}): Promise<PageResult<Voucher>> {
  return paginate(
    { page: query.page ?? 1, pageSize: query.pageSize ?? VOUCHERS_PAGE_SIZE },
    () => prisma.voucher.count(),
    ({ skip, take }) =>
      prisma.voucher.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
  );
}

export async function createVoucher(
  input: VoucherInput,
  actor: VoucherActor,
): Promise<VoucherActionResult> {
  try {
    const created = await prisma.voucher.create({ data: input });
    await logAdminAction({
      identityId: actor.identityId,
      action: "voucher.create",
      entityType: "voucher",
      entityId: created.id,
      metadata: auditMetadata(input),
    });
    revalidatePublic(CACHE_TAGS.vouchers);
    return {
      ok: true,
      message: `Đã tạo mã giảm giá ${created.code}`,
      voucherId: created.id,
    };
  } catch (error: unknown) {
    if (isKnownError(error, "P2002")) {
      return { ok: false, error: "Mã giảm giá đã tồn tại" };
    }
    throw error;
  }
}

export async function updateVoucher(
  id: string,
  input: VoucherInput,
  actor: VoucherActor,
): Promise<VoucherActionResult> {
  const existing = await prisma.voucher.findUnique({
    where: { id },
    select: { usedCount: true },
  });
  if (!existing) return NOT_FOUND;
  if (input.maxUses !== null && input.maxUses < existing.usedCount) {
    return {
      ok: false,
      error: `Số lượt tối đa không được nhỏ hơn số lượt đã dùng (${existing.usedCount})`,
    };
  }

  try {
    // Dieu kien usedCount giu bat bien maxUses >= usedCount khi co don dang ghi.
    const result = await prisma.voucher.updateMany({
      where: {
        id,
        ...(input.maxUses !== null
          ? { usedCount: { lte: input.maxUses } }
          : {}),
      },
      data: input,
    });
    if (result.count === 0) {
      return {
        ok: false,
        error: "Số lượt tối đa không được nhỏ hơn số lượt đã dùng",
      };
    }
  } catch (error: unknown) {
    if (isKnownError(error, "P2002")) {
      return { ok: false, error: "Mã giảm giá đã tồn tại" };
    }
    throw error;
  }

  await logAdminAction({
    identityId: actor.identityId,
    action: "voucher.update",
    entityType: "voucher",
    entityId: id,
    metadata: auditMetadata(input),
  });
  revalidatePublic(CACHE_TAGS.vouchers);
  return { ok: true, message: "Đã cập nhật mã giảm giá", voucherId: id };
}

export async function toggleVoucher(
  id: string,
  isActive: boolean,
  actor: VoucherActor,
): Promise<VoucherActionResult> {
  const result = await prisma.voucher.updateMany({
    where: { id },
    data: { isActive },
  });
  if (result.count === 0) return NOT_FOUND;

  await logAdminAction({
    identityId: actor.identityId,
    action: "voucher.toggle",
    entityType: "voucher",
    entityId: id,
    metadata: { isActive },
  });
  revalidatePublic(CACHE_TAGS.vouchers);
  return {
    ok: true,
    message: isActive ? "Đã bật mã giảm giá" : "Đã tạm dừng mã giảm giá",
  };
}

/** Đơn cũ chỉ lưu chuỗi `voucherCode` nên xoá voucher không ảnh hưởng đơn. */
export async function deleteVoucher(
  id: string,
  actor: VoucherActor,
): Promise<VoucherActionResult> {
  const deleted = await prisma.voucher
    .delete({ where: { id }, select: { code: true } })
    .catch((error: unknown) => {
      if (isKnownError(error, "P2025")) return null;
      throw error;
    });
  if (!deleted) return NOT_FOUND;

  await logAdminAction({
    identityId: actor.identityId,
    action: "voucher.delete",
    entityType: "voucher",
    entityId: id,
    metadata: { code: deleted.code },
  });
  revalidatePublic(CACHE_TAGS.vouchers);
  return { ok: true, message: `Đã xoá mã giảm giá ${deleted.code}` };
}

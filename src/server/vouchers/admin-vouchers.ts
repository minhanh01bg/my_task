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

const HISTORY_LOCKED: VoucherActionResult = {
  ok: false,
  error:
    "Mã giảm giá đã có trong lịch sử đơn hàng, không thể đổi mã, xoá hoặc dùng lại. Bạn có thể tạm dừng mã.",
};

async function hasOrderHistory(tx: Prisma.TransactionClient, codes: string[]) {
  return (
    (await tx.order.findFirst({
      where: { voucherCode: { in: codes } },
      select: { id: true },
    })) !== null
  );
}

/** Giữ khoá ghi SQLite trước khi đọc lịch sử, đồng bộ với transaction tạo đơn. */
async function lockVoucherWrites(tx: Prisma.TransactionClient, code: string) {
  await tx.$executeRaw`
    UPDATE "Voucher" SET "usedCount" = "usedCount" WHERE "code" = ${code}
  `;
}

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

export function getVoucherById(id: string): Promise<Voucher | null> {
  return prisma.voucher.findUnique({ where: { id } });
}

export async function createVoucher(
  input: VoucherInput,
  actor: VoucherActor,
): Promise<VoucherActionResult> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      await lockVoucherWrites(tx, input.code);
      if (await hasOrderHistory(tx, [input.code])) return null;
      return tx.voucher.create({ data: input });
    });
    if (!created) return HISTORY_LOCKED;
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
  try {
    const result = await prisma.$transaction(
      async (tx): Promise<VoucherActionResult> => {
        await lockVoucherWrites(tx, input.code);
        const existing = await tx.voucher.findUnique({
          where: { id },
          select: { code: true, usedCount: true },
        });
        if (!existing) return NOT_FOUND;
        if (
          existing.code !== input.code &&
          (await hasOrderHistory(tx, [existing.code, input.code]))
        ) {
          return HISTORY_LOCKED;
        }
        if (input.maxUses !== null && input.maxUses < existing.usedCount) {
          return {
            ok: false,
            error: `Số lượt tối đa không được nhỏ hơn số lượt đã dùng (${existing.usedCount})`,
          };
        }
        await tx.voucher.update({ where: { id }, data: input });
        return { ok: true, message: "Đã cập nhật mã giảm giá" };
      },
    );
    if (!result.ok) return result;
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

/** Giữ voucher có đơn lịch sử để huỷ đơn luôn hoàn lượt cho đúng mã. */
export async function deleteVoucher(
  id: string,
  actor: VoucherActor,
): Promise<VoucherActionResult> {
  const result = await prisma.$transaction(async (tx) => {
    // Cả khi mã không tồn tại, UPDATE vẫn lấy khoá ghi SQLite.
    await tx.$executeRaw`
      UPDATE "Voucher" SET "usedCount" = "usedCount" WHERE "id" = ${id}
    `;
    const existing = await tx.voucher.findUnique({
      where: { id },
      select: { code: true },
    });
    if (!existing) return { error: NOT_FOUND };
    if (await hasOrderHistory(tx, [existing.code]))
      return { error: HISTORY_LOCKED };
    const deleted = await tx.voucher.delete({
      where: { id },
      select: { code: true },
    });
    return { deleted };
  });
  if (result.error) return result.error;
  const deleted = result.deleted;

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

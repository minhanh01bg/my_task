import type { Prisma } from "@prisma/client";

import { maxUsesPerCustomerSchema } from "@/lib/vouchers/customer-limit";
import { logAdminAction } from "@/server/auth/admin-audit";
import { prisma } from "@/server/db/prisma";
import type { VoucherActor } from "@/server/vouchers/admin-vouchers";
import { OnlineOrderError } from "@/types/online-order";
import type { VoucherActionResult } from "@/types/voucher";

/** Khoá `Setting`: số lần mỗi khách được dùng một mã. Không có dòng = không giới hạn. */
export const MAX_USES_PER_CUSTOMER_KEY = "voucher.maxUsesPerCustomer";

/**
 * Đọc thẳng DB (không cache) để đường ghi đơn luôn dùng giá trị mới nhất.
 * Truyền `tx` khi gọi trong `$transaction`.
 */
export async function getMaxUsesPerCustomer(
  client: Pick<Prisma.TransactionClient, "setting"> = prisma,
): Promise<number | null> {
  const row = await client.setting.findUnique({
    where: { key: MAX_USES_PER_CUSTOMER_KEY },
    select: { value: true },
  });
  if (!row) return null;
  const parsed = maxUsesPerCustomerSchema.safeParse(row.value);
  return parsed.success ? parsed.data : null;
}

/** Khách vãng lai dùng mã khi đang giới hạn số lần mỗi khách. */
export const VOUCHER_LOGIN_REQUIRED_MESSAGE =
  "Vui lòng đăng nhập để dùng mã giảm giá này";

/**
 * Gọi TRONG transaction tạo đơn, ngay sau khi trừ lượt voucher: SQLite đã giữ
 * khoá ghi nên hai đơn đồng thời của cùng khách không cùng lọt qua; lỗi ném ra
 * rollback cả lượt vừa trừ.
 *
 * SĐT khách vãng lai không được xác minh — đổi số là dùng lại được mã — nên khi
 * đang giới hạn chỉ tài khoản đã đăng nhập mới dùng được mã, và chỉ đếm đơn
 * chưa huỷ của chính tài khoản đó (chưa gồm đơn đang tạo). Không bao giờ đếm
 * theo SĐT: câu "đã dùng hết" chỉ được nói về tài khoản của người gọi, không
 * được lộ rằng một SĐT nào đó từng dùng mã. Lỗi luôn là VOUCHER_INVALID để
 * lượt thử bị tính vào hạn mức dò mã.
 */
export async function assertVoucherCustomerLimit(
  tx: Prisma.TransactionClient,
  code: string,
  customerAccountId: string | null | undefined,
): Promise<void> {
  const limit = await getMaxUsesPerCustomer(tx);
  if (limit === null) return;

  if (!customerAccountId) {
    throw new OnlineOrderError(
      "VOUCHER_INVALID",
      VOUCHER_LOGIN_REQUIRED_MESSAGE,
    );
  }
  const used = await tx.order.count({
    where: {
      voucherCode: code,
      status: { not: "cancelled" },
      customerAccountId,
    },
  });
  if (used >= limit) {
    throw new OnlineOrderError(
      "VOUCHER_INVALID",
      "Bạn đã dùng hết số lần cho phép của mã giảm giá này",
    );
  }
}

/** `null` = bỏ giới hạn (xoá dòng Setting). Gọi sau khi đã kiểm tra quyền admin. */
export async function saveMaxUsesPerCustomer(
  limit: number | null,
  actor: VoucherActor,
): Promise<VoucherActionResult> {
  if (limit === null) {
    await prisma.setting.deleteMany({
      where: { key: MAX_USES_PER_CUSTOMER_KEY },
    });
  } else {
    await prisma.setting.upsert({
      where: { key: MAX_USES_PER_CUSTOMER_KEY },
      create: { key: MAX_USES_PER_CUSTOMER_KEY, value: String(limit) },
      update: { value: String(limit) },
    });
  }
  await logAdminAction({
    identityId: actor.identityId,
    action: "settings.voucher_limit.update",
    entityType: "store_settings",
    entityId: MAX_USES_PER_CUSTOMER_KEY,
    metadata: { maxUsesPerCustomer: limit },
  });
  return {
    ok: true,
    message:
      limit === null
        ? "Đã bỏ giới hạn số lần mỗi khách dùng một mã"
        : `Mỗi tài khoản khách được dùng một mã tối đa ${limit} lần; khách phải đăng nhập mới dùng được mã`,
  };
}

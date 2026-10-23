import type { Prisma } from "@prisma/client";

import { maxUsesPerCustomerSchema } from "@/lib/vouchers/customer-limit";
import { logAdminAction } from "@/server/auth/admin-audit";
import { prisma } from "@/server/db/prisma";
import { contactPhoneVariants } from "@/server/orders/open-online-orders";
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

/**
 * Gọi TRONG transaction tạo đơn, ngay sau khi trừ lượt voucher: SQLite đã giữ
 * khoá ghi nên hai đơn đồng thời của cùng khách không cùng lọt qua. Đếm đơn
 * chưa huỷ dùng mã này của cùng SĐT (cả dạng +84/0) hoặc cùng tài khoản —
 * chưa gồm đơn đang tạo.
 */
export async function assertVoucherCustomerLimit(
  tx: Prisma.TransactionClient,
  code: string,
  customer: { contactPhone: string; customerAccountId?: string | null },
): Promise<void> {
  const limit = await getMaxUsesPerCustomer(tx);
  if (limit === null) return;

  const used = await tx.order.count({
    where: {
      voucherCode: code,
      status: { not: "cancelled" },
      OR: [
        { contactPhone: { in: contactPhoneVariants(customer.contactPhone) } },
        ...(customer.customerAccountId
          ? [{ customerAccountId: customer.customerAccountId }]
          : []),
      ],
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
        : `Mỗi khách được dùng một mã tối đa ${limit} lần`,
  };
}

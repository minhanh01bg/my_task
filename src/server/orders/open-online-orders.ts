import type { Prisma } from "@prisma/client";

import { canonicalizeVietnamesePhone } from "@/types/customer-auth";
import { OnlineOrderError } from "@/types/online-order";

/**
 * So don online dang mo (cua hang chua xu ly, chua huy) toi da cho moi SDT va
 * moi tai khoan — chan giu kho bang nhieu don chua thanh toan.
 */
export const MAX_OPEN_ONLINE_ORDERS = 3;

/** `Order.contactPhone` luu ca dang `+84...` lan `0...` — dem ca hai. */
export function contactPhoneVariants(phone: string): string[] {
  const canonical = canonicalizeVietnamesePhone(phone);
  return canonical.startsWith("+84")
    ? [canonical, `0${canonical.slice(3)}`]
    : [canonical];
}

const OPEN_ONLINE_ORDER = {
  channel: "online",
  fulfillmentStatus: "new",
  status: { not: "cancelled" },
} satisfies Prisma.OrderWhereInput;

/**
 * Goi TRONG transaction tao don, sau lenh ghi dau tien: SQLite da giu khoa ghi
 * nen hai checkout dong thoi khong cung lot qua gioi han.
 */
export async function assertOpenOnlineOrderLimit(
  tx: Prisma.TransactionClient,
  owner: { contactPhone: string; customerAccountId?: string | null },
): Promise<void> {
  const byPhone = await tx.order.count({
    where: {
      ...OPEN_ONLINE_ORDER,
      contactPhone: { in: contactPhoneVariants(owner.contactPhone) },
    },
  });
  const byAccount = owner.customerAccountId
    ? await tx.order.count({
        where: {
          ...OPEN_ONLINE_ORDER,
          customerAccountId: owner.customerAccountId,
        },
      })
    : 0;

  if (
    byPhone >= MAX_OPEN_ONLINE_ORDERS ||
    byAccount >= MAX_OPEN_ONLINE_ORDERS
  ) {
    throw new OnlineOrderError(
      "TOO_MANY_OPEN_ORDERS",
      `Bạn đang có ${MAX_OPEN_ONLINE_ORDERS} đơn hàng chờ cửa hàng xử lý. Vui lòng chờ xác nhận hoặc liên hệ cửa hàng trước khi đặt thêm.`,
    );
  }
}

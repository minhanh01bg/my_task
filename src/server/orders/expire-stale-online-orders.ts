import type { Prisma } from "@prisma/client";

import { errorLogFields, logger } from "@/lib/logger";
import { deliverBackInStockAlerts } from "@/server/back-in-stock/deliver-alerts";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { createCustomerOrderStatusNotification } from "@/server/customer-notifications/create-customer-notification";
import { prisma } from "@/server/db/prisma";

import { cancelOrder } from "./cancel-order";

/** Don online "new" chua thanh toan qua moc nay thi tu huy de tra ton kho. */
export const STALE_ONLINE_ORDER_TTL_MS = 24 * 60 * 60 * 1000;
export const STALE_ORDER_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
/** Moi luot chi xu ly chung nay don — luot sau lam tiep, transaction van ngan. */
const SWEEP_BATCH_SIZE = 100;

/**
 * Chi don online cua hang chua dong vao, chua thu tien: khong bao gio huy don
 * POS, don da thanh toan hay da xac nhan.
 */
function staleOrderWhere(cutoff: Date): Prisma.OrderWhereInput {
  return {
    channel: "online",
    fulfillmentStatus: "new",
    status: "pending",
    createdAt: { lte: cutoff },
    payments: { none: { receivedAt: { not: null } } },
  };
}

export interface ExpireStaleOnlineOrdersResult {
  cancelled: number;
}

/**
 * Huy don online qua han qua `cancelOrder` (hoan ton kho, soldCount, luot
 * voucher). Moi don mot transaction ngan; lenh dau tien la ghi co dieu kien nen
 * hai luot chay song song (hoac admin vua xac nhan/thanh toan) khong huy trung.
 */
export async function expireStaleOnlineOrders(
  now: Date = new Date(),
): Promise<ExpireStaleOnlineOrdersResult> {
  const cutoff = new Date(now.getTime() - STALE_ONLINE_ORDER_TTL_MS);
  const candidates = await prisma.order.findMany({
    where: staleOrderWhere(cutoff),
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: SWEEP_BATCH_SIZE,
  });

  const cancelledIds: string[] = [];
  let voucherRestored = false;
  const restockedProductIds = new Set<string>();
  for (const candidate of candidates) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Lenh GHI dau tien: giu khoa ghi va kiem tra lai dieu kien cung luc.
        const claimed = await tx.order.updateMany({
          where: { id: candidate.id, ...staleOrderWhere(cutoff) },
          data: { fulfillmentStatus: "new" },
        });
        if (claimed.count === 0) return null;

        const cancelled = await cancelOrder(candidate.id, tx);
        if (!cancelled.cancelled) return null;

        const order = await tx.order.findUniqueOrThrow({
          where: { id: candidate.id },
          select: { id: true, code: true, customerAccountId: true },
        });
        await tx.adminNotification.create({
          data: {
            eventKey: `online-order:${order.id}:expired`,
            kind: "online_order_expired",
            title: "Đơn online tự hủy do quá hạn",
            body: `Đơn ${order.code} chưa thanh toán sau 24 giờ, đã hoàn tồn kho`,
            entityType: "order",
            entityId: order.id,
            href: `/admin/orders/${encodeURIComponent(order.id)}`,
          },
        });
        await createCustomerOrderStatusNotification(tx, order, "cancelled");
        return cancelled;
      });
      if (result) {
        cancelledIds.push(candidate.id);
        if (result.voucherCode) voucherRestored = true;
        for (const id of result.restockedProductIds) {
          restockedProductIds.add(id);
        }
      }
    } catch (error: unknown) {
      logger.error("stale_online_order_cancel_failed", {
        orderId: candidate.id,
        ...errorLogFields(error),
      });
    }
  }

  // Sau commit: ton kho/luot voucher da doi.
  if (cancelledIds.length > 0) {
    if (voucherRestored) {
      revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.vouchers);
    } else {
      revalidatePublic(CACHE_TAGS.catalog);
    }
    logger.info("stale_online_orders_expired", {
      count: cancelledIds.length,
      orderIds: cancelledIds,
    });
    await deliverBackInStockAlerts(restockedProductIds);
  }
  return { cancelled: cancelledIds.length };
}

// Giu tren globalThis: HMR nap lai module hoac `register()` chay lai van thay
// timer cu, khong hen them mot vong quet song song.
const timerHost = globalThis as unknown as Record<
  symbol,
  NodeJS.Timeout | undefined
>;
const TIMER_KEY = Symbol.for("orders.staleOnlineOrderExpiryTimer");

/**
 * Hen gio quet don qua han trong tien trinh server. Timer `unref` de khong giu
 * tien trinh song; luot truoc chua xong thi bo qua tick; loi chi ghi log.
 * Moi tien trinh chi mot timer: goi lai tra timer dang chay. Khong hen gio (tra
 * `null`) khi `DISABLE_BACKGROUND_JOBS=1` (e2e).
 */
export function scheduleStaleOnlineOrderExpiry(
  options: {
    run?: () => Promise<unknown>;
    intervalMs?: number;
  } = {},
): NodeJS.Timeout | null {
  if (process.env.DISABLE_BACKGROUND_JOBS === "1") return null;
  const existing = timerHost[TIMER_KEY];
  if (existing) return existing;

  const run = options.run ?? (() => expireStaleOnlineOrders());
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await run();
    } catch (error: unknown) {
      logger.error("stale_online_order_expiry_failed", errorLogFields(error));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(
    () => void tick(),
    options.intervalMs ?? STALE_ORDER_SWEEP_INTERVAL_MS,
  );
  timer.unref();
  timerHost[TIMER_KEY] = timer;
  return timer;
}

/** Huy timer va guard (test). */
export function stopStaleOnlineOrderExpiry(): void {
  clearInterval(timerHost[TIMER_KEY]);
  timerHost[TIMER_KEY] = undefined;
}

import type { Prisma } from "@prisma/client";

import { errorLogFields, logger } from "@/lib/logger";
import { productHref } from "@/lib/seo/product-href";
import { expirePublicPathsNow } from "@/server/cache/public-cache";
import { createBackInStockNotification } from "@/server/customer-notifications/create-customer-notification";
import { prisma } from "@/server/db/prisma";

import {
  MIN_BACK_IN_STOCK_READY_STOCK,
  ONLINE_SELLABLE_PRODUCT_WHERE,
} from "./subscriptions";

export const BACK_IN_STOCK_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
/** Moi transaction gui toi da chung nay dang ky — transaction van ngan. */
const DELIVERY_BATCH_SIZE = 50;
/** Moi luot sweep xu ly chung nay san pham — luot sau lam tiep. */
const SWEEP_PRODUCT_LIMIT = 100;

/** San pham bao duoc: dang ban online va du hang cho mot don online. */
const READY_PRODUCT_WHERE = {
  ...ONLINE_SELLABLE_PRODUCT_WHERE,
  stock: { gte: MIN_BACK_IN_STOCK_READY_STOCK },
} satisfies Prisma.ProductWhereInput;

/**
 * Mot lo: doc lai san pham (con "san sang" khong), xoa tung dang ky roi tao
 * thong bao cho no trong cung transaction. Dong da bi xoa (luot khac vua gui,
 * khach vua huy) thi bo qua — nen khong bao gio gui trung.
 */
async function deliverBatch(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<{ sent: number; more: boolean }> {
  const product = await tx.product.findFirst({
    where: { id: productId, ...READY_PRODUCT_WHERE },
    select: { id: true, name: true, slug: true },
  });
  if (!product) return { sent: 0, more: false };

  const subscriptions = await tx.backInStockSubscription.findMany({
    where: { productId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: DELIVERY_BATCH_SIZE,
    select: { id: true, accountId: true },
  });
  let sent = 0;
  for (const subscription of subscriptions) {
    const { count } = await tx.backInStockSubscription.deleteMany({
      where: { id: subscription.id },
    });
    if (count === 0) continue;
    await createBackInStockNotification(tx, {
      subscriptionId: subscription.id,
      accountId: subscription.accountId,
      product,
    });
    sent += 1;
  }
  return { sent, more: subscriptions.length === DELIVERY_BATCH_SIZE };
}

/**
 * Gui bao co hang cho cac san pham vua tang ton kho. Khong bao gio nem: loi
 * chi ghi log, dang ky con lai de sweep gui bu. Chi goi SAU khi transaction ghi
 * ton kho da commit. `revalidatePublic` ("max") chi danh dau stale — lan tai
 * dau tien (chinh la luc khach bam thong bao) van nhan ban "het hang" — nen
 * truoc khi tao thong bao, ham nay tu het han ngay cache trang san pham. Khong
 * ai cho thi chi mot lan doc, khong mo transaction, khong dung cache.
 */
export async function deliverBackInStockAlerts(
  productIds: Iterable<string>,
): Promise<{ delivered: number }> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return { delivered: 0 };

  let ready: { id: string; slug: string | null }[];
  try {
    ready = await prisma.product.findMany({
      where: {
        id: { in: ids },
        ...READY_PRODUCT_WHERE,
        backInStockSubscriptions: { some: {} },
      },
      select: { id: true, slug: true },
    });
  } catch (error: unknown) {
    logger.error("back_in_stock_delivery_failed", {
      productIds: ids,
      ...errorLogFields(error),
    });
    return { delivered: 0 };
  }

  // Thong bao dua khach toi dung trang nay: het han ngay (khong
  // stale-while-revalidate) truoc khi tao thong bao nao, de lan bam dau tien
  // doc ton kho moi. `/shop/p/<slug>` chi gan tag catalog nen het han theo duong
  // dan, khong theo tag.
  if (ready.length > 0) {
    expirePublicPathsNow(...ready.map((product) => productHref(product)));
  }

  let delivered = 0;
  const deliveredProductIds: string[] = [];
  for (const { id: productId } of ready) {
    let sentForProduct = 0;
    try {
      let more = true;
      while (more) {
        const batch = await prisma.$transaction((tx) =>
          deliverBatch(tx, productId),
        );
        sentForProduct += batch.sent;
        more = batch.more;
      }
    } catch (error: unknown) {
      logger.error("back_in_stock_delivery_failed", {
        productId,
        ...errorLogFields(error),
      });
    }
    // Lo da commit truoc loi van tinh la da gui.
    if (sentForProduct > 0) {
      delivered += sentForProduct;
      deliveredProductIds.push(productId);
    }
  }

  if (delivered > 0) {
    logger.info("back_in_stock_alerts_delivered", {
      delivered,
      productIds: deliveredProductIds,
    });
  }
  return { delivered };
}

/**
 * Luoi an toan: gui bu dang ky con treo cua san pham da co hang. San pham co
 * dang ky cho lau nhat di truoc, nen qua gioi han thi khong san pham nao bi bo
 * doi mai. groupBy chay GROUP BY/LIMIT trong SQL (`distinct` cua Prisma loc
 * trong bo nho sau khi doc het dong).
 */
export async function sweepBackInStockAlerts(): Promise<{
  delivered: number;
}> {
  const ready = await prisma.backInStockSubscription.groupBy({
    by: ["productId"],
    where: { product: READY_PRODUCT_WHERE },
    orderBy: [{ _min: { createdAt: "asc" } }, { productId: "asc" }],
    take: SWEEP_PRODUCT_LIMIT,
  });
  return deliverBackInStockAlerts(ready.map(({ productId }) => productId));
}

// Giu tren globalThis: HMR nap lai module hoac `register()` chay lai van thay
// timer cu, khong hen them mot vong quet song song.
const timerHost = globalThis as unknown as Record<
  symbol,
  NodeJS.Timeout | undefined
>;
const TIMER_KEY = Symbol.for("backInStock.sweepTimer");

/**
 * Hen gio sweep trong tien trinh server. Timer `unref` de khong giu tien trinh
 * song; luot truoc chua xong thi bo qua tick; loi chi ghi log. Moi tien trinh
 * chi mot timer: goi lai tra timer dang chay. Khong hen gio (tra `null`) khi
 * `DISABLE_BACKGROUND_JOBS=1` (e2e).
 */
export function scheduleBackInStockSweep(
  options: {
    run?: () => Promise<unknown>;
    intervalMs?: number;
  } = {},
): NodeJS.Timeout | null {
  if (process.env.DISABLE_BACKGROUND_JOBS === "1") return null;
  const existing = timerHost[TIMER_KEY];
  if (existing) return existing;

  const run = options.run ?? (() => sweepBackInStockAlerts());
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await run();
    } catch (error: unknown) {
      logger.error("back_in_stock_sweep_failed", errorLogFields(error));
    } finally {
      running = false;
    }
  };
  const timer = setInterval(
    () => void tick(),
    options.intervalMs ?? BACK_IN_STOCK_SWEEP_INTERVAL_MS,
  );
  timer.unref();
  timerHost[TIMER_KEY] = timer;
  return timer;
}

/** Huy timer va guard (test). */
export function stopBackInStockSweep(): void {
  clearInterval(timerHost[TIMER_KEY]);
  timerHost[TIMER_KEY] = undefined;
}

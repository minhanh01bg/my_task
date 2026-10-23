import { errorLogFields, logger } from "@/lib/logger";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

import { recomputeProductRating } from "./product-rating";
import { hasVerifiedPurchase } from "./verified-purchase";

/** Setting danh dau backfill da chay xong (gia tri "1"). */
export const VERIFIED_RATING_BACKFILL_KEY = "reviews.verified_rating_backfill";
/** Cho server khoi dong va phuc vu request dau tien truoc khi chay. */
export const VERIFIED_RATING_BACKFILL_DELAY_MS = 30_000;

export interface VerifiedRatingBackfillResult {
  /** false khi Setting cho biet da chay tu truoc (khong ghi gi). */
  ran: boolean;
  products: number;
}

/**
 * Chay MOT lan (Setting `VERIFIED_RATING_BACKFILL_KEY`): diem luu truoc BL-4
 * tinh ca danh gia chua mua, va nhan "da mua" tung gan theo quy tac cu (don
 * online `paid` chua giao, don da huy). Moi san pham co danh gia: bo nhan da
 * mua cua tai khoan khong con don du dieu kien roi tinh lai diem, trong mot
 * transaction ngan rieng. Revalidate `catalog` sau commit. Chay lai an toan.
 */
export async function backfillVerifiedRatings(): Promise<VerifiedRatingBackfillResult> {
  const done = await prisma.setting.findUnique({
    where: { key: VERIFIED_RATING_BACKFILL_KEY },
    select: { value: true },
  });
  if (done?.value === "1") return { ran: false, products: 0 };

  const products = await prisma.productReview.findMany({
    distinct: ["productId"],
    select: { productId: true },
  });
  for (const { productId } of products) {
    await prisma.$transaction(async (tx) => {
      const verified = await tx.productReview.findMany({
        where: {
          productId,
          isVerifiedPurchase: true,
          accountId: { not: null },
        },
        select: { id: true, accountId: true },
      });
      for (const review of verified) {
        const accountId = review.accountId;
        if (!accountId || (await hasVerifiedPurchase(tx, accountId, productId)))
          continue;
        await tx.productReview.update({
          where: { id: review.id },
          data: { isVerifiedPurchase: false },
          select: { id: true },
        });
      }
      await recomputeProductRating(tx, productId);
    });
  }

  await prisma.setting.upsert({
    where: { key: VERIFIED_RATING_BACKFILL_KEY },
    create: { key: VERIFIED_RATING_BACKFILL_KEY, value: "1" },
    update: { value: "1" },
  });
  if (products.length > 0) revalidatePublic(CACHE_TAGS.catalog);
  logger.info("review_rating_backfill_done", { products: products.length });
  return { ran: true, products: products.length };
}

// Giu tren globalThis: HMR nap lai module hoac `register()` chay lai van thay
// timer cu, khong hen them mot lan backfill.
const timerHost = globalThis as unknown as Record<
  symbol,
  NodeJS.Timeout | undefined
>;
const TIMER_KEY = Symbol.for("reviews.verifiedRatingBackfillTimer");

/**
 * Hen chay backfill mot lan sau khi server khoi dong, khong chan boot. Timer
 * `unref` de khong giu tien trinh song; loi chi ghi log — Setting chua duoc
 * ghi nen lan khoi dong sau chay lai. Moi tien trinh chi hen mot lan: goi lai
 * tra timer da hen. Khong hen gio (tra `null`) khi `DISABLE_BACKGROUND_JOBS=1`
 * (e2e).
 */
export function scheduleVerifiedRatingBackfill(
  options: {
    run?: () => Promise<unknown>;
    delayMs?: number;
  } = {},
): NodeJS.Timeout | null {
  if (process.env.DISABLE_BACKGROUND_JOBS === "1") return null;
  const existing = timerHost[TIMER_KEY];
  if (existing) return existing;

  const run = options.run ?? (() => backfillVerifiedRatings());
  const timer = setTimeout(() => {
    void run().catch((error: unknown) => {
      logger.error("review_rating_backfill_failed", errorLogFields(error));
    });
  }, options.delayMs ?? VERIFIED_RATING_BACKFILL_DELAY_MS);
  timer.unref();
  timerHost[TIMER_KEY] = timer;
  return timer;
}

/** Huy timer va guard (test). */
export function stopVerifiedRatingBackfill(): void {
  clearTimeout(timerHost[TIMER_KEY]);
  timerHost[TIMER_KEY] = undefined;
}

import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import {
  publicPromotionSchema,
  type PromotionPlacement,
  type PublicPromotion,
} from "@/types/storefront";

export interface GetActivePromotionsOptions {
  placement?: PromotionPlacement;
  now?: Date;
  limit?: number;
}

/**
 * Khuyen mai dang chay, cache theo tag promotions (60s). Truyen `now` tuong
 * minh (test, xem truoc) thi doc thang DB de khong sinh khoa cache theo thoi diem.
 * Voi cache, moc bat dau/ket thuc co the tre toi da `revalidate` giay.
 */
export async function getActivePromotions(
  options: GetActivePromotionsOptions = {},
): Promise<PublicPromotion[]> {
  const limit = options.limit ?? 10;

  if (options.now) {
    return loadActivePromotions(options.placement, limit, options.now);
  }

  return cachedPublic(
    () => loadActivePromotions(options.placement, limit, new Date()),
    ["active-promotions", options.placement ?? "all", String(limit)],
    { tags: [CACHE_TAGS.promotions], revalidate: 60 },
  );
}

async function loadActivePromotions(
  placement: PromotionPlacement | undefined,
  limit: number,
  now: Date,
): Promise<PublicPromotion[]> {
  const rows = await prisma.storefrontPromotion.findMany({
    where: {
      isActive: true,
      ...(placement ? { placement } : {}),
      AND: [
        {
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        },
        {
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
        },
      ],
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      body: true,
      imageUrl: true,
      ctaLabel: true,
      ctaHref: true,
      placement: true,
      priority: true,
    },
  });

  const validated: PublicPromotion[] = [];

  for (const row of rows) {
    // Check for unsafe ctaHref scheme before schema validation
    if (row.ctaHref) {
      const trimmedHref = row.ctaHref.trim().toLowerCase();
      if (
        trimmedHref.startsWith("javascript:") ||
        trimmedHref.startsWith("data:") ||
        trimmedHref.startsWith("vbscript:")
      ) {
        continue;
      }
    }

    const parsed = publicPromotionSchema.safeParse({
      ...row,
      body: row.body ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      ctaLabel: row.ctaLabel ?? undefined,
      ctaHref: row.ctaHref ?? undefined,
    });

    if (parsed.success) {
      validated.push(parsed.data);
    }
  }

  return validated;
}

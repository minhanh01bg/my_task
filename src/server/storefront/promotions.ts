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

export async function getActivePromotions(
  options: GetActivePromotionsOptions = {},
): Promise<PublicPromotion[]> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 10;

  const rows = await prisma.storefrontPromotion.findMany({
    where: {
      isActive: true,
      ...(options.placement ? { placement: options.placement } : {}),
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

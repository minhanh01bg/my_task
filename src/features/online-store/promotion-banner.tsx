import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import type { PromotionPlacement, PublicPromotion } from "@/types/storefront";

export interface PromotionBannerProps {
  promotions: PublicPromotion[];
  placement?: PromotionPlacement;
}

export function PromotionBanner({
  promotions,
  placement = "announcement",
}: PromotionBannerProps) {
  if (!promotions || promotions.length === 0) {
    return null;
  }

  const promo = promotions[0];

  if (placement === "hero") {
    return (
      <div className="from-primary/90 to-primary text-primary-foreground relative my-6 overflow-hidden rounded-3xl bg-gradient-to-r shadow-md">
        <div className="relative z-10 flex flex-col justify-between p-6 sm:p-10 lg:flex-row lg:items-center">
          <div className="max-w-xl space-y-3">
            <div className="bg-primary-foreground/15 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Khuyến mãi đặc biệt</span>
            </div>
            <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
              {promo.title}
            </h2>
            {promo.body ? (
              <p className="text-primary-foreground/90 text-sm leading-relaxed sm:text-base">
                {promo.body}
              </p>
            ) : null}
            {promo.ctaLabel && promo.ctaHref ? (
              <div className="pt-2">
                <Link
                  href={promo.ctaHref}
                  className="bg-background text-foreground hover:bg-background/90 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold shadow-xs transition-colors"
                >
                  <span>{promo.ctaLabel}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>

          {promo.imageUrl ? (
            <div className="relative mt-6 aspect-video w-full max-w-sm overflow-hidden rounded-2xl lg:mt-0">
              <Image
                src={promo.imageUrl}
                alt={promo.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 384px"
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Announcement bar (default)
  return (
    <aside
      aria-label="Thông báo khuyến mãi"
      className="border-primary/20 bg-primary/10 text-primary border-b px-4 py-3 text-center text-sm font-medium"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1 font-bold">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{promo.title}</span>
        </span>
        {promo.body ? (
          <span className="text-primary/80 hidden sm:inline">
            <span aria-hidden="true">— </span>
            <span>{promo.body}</span>
          </span>
        ) : null}
        {promo.ctaLabel && promo.ctaHref ? (
          <Link
            href={promo.ctaHref}
            className="ml-1 inline-flex items-center gap-0.5 font-bold hover:underline"
          >
            <span>{promo.ctaLabel}</span>
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

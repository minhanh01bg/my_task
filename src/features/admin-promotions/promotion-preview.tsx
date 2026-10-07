"use client";

import { useState } from "react";
import Image from "next/image";
import {
  IconArrowRight as ArrowRight,
  IconEye as Eye,
  IconDeviceDesktop as Monitor,
  IconDeviceMobile as Smartphone,
  IconSparkles as Sparkles,
} from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import { promotionActionSchema } from "@/types/storefront";

export function PromotionPreview({
  title,
  body,
  placement,
  imageUrl,
  ctaLabel,
}: {
  title: string;
  body: string;
  placement: string;
  imageUrl: string;
  ctaLabel: string;
}) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const parsedImage = promotionActionSchema.shape.imageUrl.safeParse(imageUrl);
  const safeImageUrl = parsedImage.success ? parsedImage.data : null;
  return (
    <Card className="min-w-0 self-start lg:sticky lg:top-24">
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="text-primary h-4 w-4" />
            <span>Xem trước trực tiếp</span>
          </div>

          <div className="border-border bg-muted/40 flex items-center gap-1 rounded-lg border p-1 text-xs">
            <button
              type="button"
              aria-pressed={previewDevice === "desktop"}
              onClick={() => setPreviewDevice("desktop")}
              className={`flex min-h-10 items-center gap-1 rounded-md px-2 py-1 ${
                previewDevice === "desktop"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Máy tính</span>
            </button>
            <button
              type="button"
              aria-pressed={previewDevice === "mobile"}
              onClick={() => setPreviewDevice("mobile")}
              className={`flex min-h-10 items-center gap-1 rounded-md px-2 py-1 ${
                previewDevice === "mobile"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Di động</span>
            </button>
          </div>
        </div>

        <div
          className={`border-border bg-muted/20 mx-auto overflow-hidden rounded-2xl border p-4 ${
            previewDevice === "mobile" ? "max-w-xs" : "w-full"
          }`}
        >
          <div className="text-muted-foreground mb-3 text-xs">
            Giao diện{" "}
            {placement === "announcement"
              ? "thanh thông báo"
              : placement === "hero"
                ? "banner đầu trang"
                : "banner phụ"}
            :
          </div>

          {placement === "announcement" ? (
            <div className="border-primary/20 bg-primary/10 text-primary rounded-xl border p-3 text-center text-xs font-medium [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-1 font-bold">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{title || "Tiêu đề thông báo khuyến mãi"}</span>
                </span>
                {body ? (
                  <span className="text-primary/80">— {body}</span>
                ) : null}
                {ctaLabel ? (
                  <span className="ml-1 font-bold underline">{ctaLabel} →</span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="from-primary/90 to-primary text-primary-foreground relative overflow-hidden rounded-2xl bg-gradient-to-r p-5 shadow-sm">
              <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
                <span className="bg-primary-foreground/20 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                  <Sparkles className="h-3 w-3" />
                  <span>Khuyến mãi đặc biệt</span>
                </span>
                <h3 className="text-lg font-bold [overflow-wrap:anywhere] break-words sm:text-xl">
                  {title || "Tiêu đề banner lớn"}
                </h3>
                {body ? (
                  <p className="text-primary-foreground/90 text-xs leading-relaxed">
                    {body}
                  </p>
                ) : null}
                {ctaLabel ? (
                  <div className="pt-2">
                    <span className="bg-background text-foreground inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold shadow-xs">
                      <span>{ctaLabel}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                ) : null}
              </div>
              {safeImageUrl ? (
                <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-xl">
                  <Image
                    src={safeImageUrl}
                    alt={title || "Preview"}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

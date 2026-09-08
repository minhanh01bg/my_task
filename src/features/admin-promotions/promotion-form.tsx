"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { ArrowRight, Eye, Monitor, Smartphone, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StorefrontPromotion } from "@prisma/client";

import { savePromotionAction } from "@/app/admin/promotions/actions";
import type { PromotionActionResult } from "@/types/storefront";

interface PromotionFormProps {
  initialData?: StorefrontPromotion | null;
  onSuccess?: () => void;
}

export function PromotionForm({ initialData, onSuccess }: PromotionFormProps) {
  const [state, formAction, pending] = useActionState<
    PromotionActionResult | null,
    FormData
  >(async (prevState, formData) => {
    const res = await savePromotionAction(prevState, formData);
    if (res.ok && onSuccess) {
      onSuccess();
    }
    return res;
  }, null);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [body, setBody] = useState(initialData?.body ?? "");
  const [placement, setPlacement] = useState(
    initialData?.placement ?? "announcement",
  );
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? "");
  const [ctaLabel, setCtaLabel] = useState(initialData?.ctaLabel ?? "");
  const [ctaHref, setCtaHref] = useState(initialData?.ctaHref ?? "");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      {/* Form Fields */}
      <form action={formAction} className="space-y-6">
        {initialData?.id ? (
          <input type="hidden" name="id" value={initialData.id} />
        ) : null}

        {state ? (
          state.ok ? (
            <div
              role="status"
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300"
            >
              ✓ {state.message}
            </div>
          ) : (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-xl border p-4 text-sm font-medium"
            >
              ✕ {state.error}
            </div>
          )
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>
              {initialData
                ? "Chỉnh sửa chiến dịch"
                : "Tạo chiến dịch khuyến mãi mới"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="promo-title">
                Tiêu đề khuyến mãi <span className="text-destructive">*</span>
              </Label>
              <Input
                id="promo-title"
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Miễn phí giao hàng tháng 9"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promo-body">Nội dung chi tiết</Label>
              <textarea
                id="promo-body"
                name="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="VD: Áp dụng cho đơn hàng từ 200.000 ₫ khi đặt qua online store"
                rows={3}
                maxLength={1000}
                className="border-input bg-background w-full rounded-xl border p-3 text-sm outline-none focus-visible:ring-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="promo-placement">Vị trí hiển thị</Label>
                <select
                  id="promo-placement"
                  name="placement"
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value)}
                  className="border-input bg-background h-10 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
                >
                  <option value="announcement">
                    Thanh thông báo trên cùng (Announcement bar)
                  </option>
                  <option value="hero">
                    Banner lớn trang chủ (Hero banner)
                  </option>
                  <option value="banner">Banner phụ (Banner)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promo-priority">Thứ tự ưu tiên</Label>
                <Input
                  id="promo-priority"
                  name="priority"
                  type="number"
                  defaultValue={initialData?.priority ?? 0}
                  placeholder="Số lớn hơn được ưu tiên trước"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="promo-image">
                Đường dẫn hình ảnh (cho Hero/Banner)
              </Label>
              <Input
                id="promo-image"
                name="imageUrl"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="VD: https://images.unsplash.com/... hoặc ảnh hợp lệ"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="promo-cta-label">Nhãn nút CTA</Label>
                <Input
                  id="promo-cta-label"
                  name="ctaLabel"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="VD: Mua ngay, Xem ưu đãi"
                  maxLength={50}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promo-cta-href">
                  Đường dẫn CTA (nội bộ hoặc HTTPS)
                </Label>
                <Input
                  id="promo-cta-href"
                  name="ctaHref"
                  value={ctaHref}
                  onChange={(e) => setCtaHref(e.target.value)}
                  placeholder="VD: /shop#catalog hoặc https://..."
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="promo-starts-at">
                  Thời gian bắt đầu (tùy chọn)
                </Label>
                <Input
                  id="promo-starts-at"
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={
                    initialData?.startsAt
                      ? new Date(initialData.startsAt)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="promo-ends-at">
                  Thời gian kết thúc (tùy chọn)
                </Label>
                <Input
                  id="promo-ends-at"
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={
                    initialData?.endsAt
                      ? new Date(initialData.endsAt).toISOString().slice(0, 16)
                      : ""
                  }
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="isActive"
                  value="true"
                  defaultChecked={initialData ? initialData.isActive : true}
                  className="h-4 w-4 rounded"
                />
                <span>Kích hoạt chiến dịch ngay</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={pending}>
          {pending
            ? "Đang lưu chiến dịch…"
            : initialData
              ? "Cập nhật chiến dịch"
              : "Tạo chiến dịch"}
        </Button>
      </form>

      {/* Live Preview Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Eye className="text-primary h-4 w-4" />
            <span>Xem trước trực tiếp</span>
          </div>

          <div className="border-border bg-muted/40 flex items-center gap-1 rounded-lg border p-1 text-xs">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 ${
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
              onClick={() => setPreviewDevice("mobile")}
              className={`flex items-center gap-1 rounded-md px-2 py-1 ${
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
          className={`border-border bg-muted/20 mx-auto overflow-hidden rounded-2xl border p-4 transition-all ${
            previewDevice === "mobile" ? "max-w-sm" : "w-full"
          }`}
        >
          <div className="text-muted-foreground mb-3 text-xs">
            Giao diện{" "}
            {placement === "announcement" ? "thanh thông báo" : "banner hero"}:
          </div>

          {placement === "announcement" ? (
            <div className="border-primary/20 bg-primary/10 text-primary rounded-xl border p-3 text-center text-xs font-medium">
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
              <div className="space-y-2">
                <span className="bg-primary-foreground/20 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                  <Sparkles className="h-3 w-3" />
                  <span>Khuyến mãi đặc biệt</span>
                </span>
                <h3 className="text-lg font-bold sm:text-xl">
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
              {imageUrl ? (
                <div className="relative mt-3 aspect-video w-full overflow-hidden rounded-xl">
                  <Image
                    src={imageUrl}
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
      </div>
    </div>
  );
}

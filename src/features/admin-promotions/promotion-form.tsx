"use client";

import type { StorefrontPromotion } from "@prisma/client";
import {
  IconCalendar,
  IconCheck,
  IconLoader2,
  IconPhoto,
  IconPlus,
} from "@tabler/icons-react";
import { useId, useRef, useState, useTransition } from "react";

import { savePromotionAction } from "@/app/(management)/admin/promotions/actions";
import { InputField } from "@/components/shared/input-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { promotionActionSchema } from "@/types/storefront";

import { PROMOTION_PLACEMENTS } from "./promotion-placement";
import { PromotionPreview } from "./promotion-preview";

function initialValues(data?: StorefrontPromotion | null) {
  return {
    title: data?.title ?? "",
    body: data?.body ?? "",
    imageUrl: data?.imageUrl ?? "",
    ctaLabel: data?.ctaLabel ?? "",
    ctaHref: data?.ctaHref ?? "",
    placement: data?.placement ?? "announcement",
    priority: String(data?.priority ?? 0),
    startsAt: data?.startsAt ? data.startsAt.toISOString().slice(0, 16) : "",
    endsAt: data?.endsAt ? data.endsAt.toISOString().slice(0, 16) : "",
    isActive: data?.isActive ?? true,
  };
}

type Values = ReturnType<typeof initialValues>;
type Field = keyof Values;
function validationErrors(values: Values) {
  const parsed = promotionActionSchema.safeParse(values);
  const errors: Partial<Record<Field, string>> = {};
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as Field;
      if (field in values && !errors[field]) errors[field] = issue.message;
    }
  return errors;
}

export function PromotionForm({
  initialData,
  onSuccess,
}: {
  initialData?: StorefrontPromotion | null;
  onSuccess?: () => void;
}) {
  const prefix = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(() => initialValues(initialData));
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const focusError = (fieldErrors: Partial<Record<Field, string>>) => {
    const field = Object.keys(fieldErrors).find(
      (field) => fieldErrors[field as Field],
    );
    if (field)
      formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  };
  function update<K extends Field>(field: K, value: Values[K]) {
    const next = { ...values, [field]: value };
    setValues(next);
    setFormError(undefined);
    if (Object.values(errors).some(Boolean)) setErrors(validationErrors(next));
  }
  function textProps(field: Exclude<Field, "isActive">, label: string) {
    return {
      id: `${prefix}-${field}`,
      name: field,
      label,
      value: values[field],
      error: errors[field],
      readOnly: pending,
      className: "h-11",
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        update(field, event.target.value),
      onBlur: () =>
        setErrors((previous) => ({
          ...previous,
          [field]: validationErrors(values)[field],
        })),
    };
  }

  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            {initialData ? "Chỉnh sửa chiến dịch" : "Tạo chiến dịch mới"}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Soạn nội dung, chọn vị trí và xem trước trước khi lưu.
          </p>
        </CardHeader>
        <CardContent>
          <form
            ref={formRef}
            noValidate
            aria-busy={pending}
            aria-label={initialData ? "Chỉnh sửa chiến dịch" : "Tạo chiến dịch"}
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending) return;
              setFormError(undefined);
              const fieldErrors = validationErrors(values);
              setErrors(fieldErrors);
              if (Object.keys(fieldErrors).length) {
                focusError(fieldErrors);
                return;
              }
              const data = new FormData();
              for (const [field, value] of Object.entries(values))
                data.set(field, String(value));
              if (initialData) data.set("id", initialData.id);
              startTransition(async () => {
                try {
                  const result = await savePromotionAction(null, data);
                  if (!result.ok) {
                    setErrors(result.fieldErrors ?? {});
                    setFormError(
                      Object.keys(result.fieldErrors ?? {}).length
                        ? undefined
                        : result.error,
                    );
                    focusError(result.fieldErrors ?? {});
                    return;
                  }
                  toast.add({ title: result.message, type: "success" });
                  if (!initialData) setValues(initialValues());
                  onSuccess?.();
                } catch {
                  setFormError("Không thể lưu chiến dịch. Vui lòng thử lại.");
                }
              });
            }}
          >
            {formError ? (
              <p
                role="alert"
                className="border-destructive/20 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm"
              >
                {formError}
              </p>
            ) : null}
            <section className="space-y-4" aria-label="Nội dung chiến dịch">
              <InputField
                {...textProps("title", "Tiêu đề khuyến mãi (bắt buộc)")}
                required
                placeholder="Ví dụ: Ưu đãi cuối tuần"
                hint="Tiêu đề ngắn, nêu rõ ưu đãi. Tối đa 200 ký tự."
              />
              <div className="space-y-2">
                <Label htmlFor={`${prefix}-body`}>Nội dung chi tiết</Label>
                <Textarea
                  id={`${prefix}-body`}
                  name="body"
                  value={values.body}
                  readOnly={pending}
                  rows={3}
                  placeholder="Ví dụ: Miễn phí giao hàng cho đơn từ 200.000 ₫"
                  aria-invalid={!!errors.body}
                  aria-describedby={
                    errors.body ? `${prefix}-body-error` : undefined
                  }
                  onChange={(event) => update("body", event.target.value)}
                  onBlur={() =>
                    setErrors((previous) => ({
                      ...previous,
                      body: validationErrors(values).body,
                    }))
                  }
                />
                {errors.body ? (
                  <p
                    role="alert"
                    id={`${prefix}-body-error`}
                    className="text-destructive text-sm"
                  >
                    {errors.body}
                  </p>
                ) : null}
              </div>
            </section>
            <section
              className="space-y-4 border-t pt-5"
              aria-labelledby={`${prefix}-display`}
            >
              <h3
                id={`${prefix}-display`}
                className="flex items-center gap-2 font-semibold"
              >
                <IconPhoto className="text-primary size-4" aria-hidden="true" />
                Hiển thị trên cửa hàng
              </h3>
              <fieldset disabled={pending}>
                <legend className="mb-2 text-sm font-medium">
                  Vị trí hiển thị
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PROMOTION_PLACEMENTS.map(
                    ({ value, label, description, icon: Icon }) => (
                      <label
                        key={value}
                        className={`has-focus-visible:ring-ring/50 flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-3 text-sm has-focus-visible:ring-3 ${values.placement === value ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}
                      >
                        <input
                          type="radio"
                          name="placement"
                          value={value}
                          checked={values.placement === value}
                          onChange={() => update("placement", value)}
                          className="sr-only"
                        />
                        <Icon className="size-5" aria-hidden="true" />
                        <span className="font-semibold">{label}</span>
                        <span className="text-muted-foreground text-xs leading-relaxed">
                          {description}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <InputField
                {...textProps("imageUrl", "Đường dẫn hình ảnh")}
                inputMode="url"
                placeholder="/uploads/uu-dai.jpg hoặc https://…"
                hint="Ảnh dùng cho banner. Chấp nhận ảnh nội bộ hoặc URL HTTPS công khai."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  {...textProps("ctaLabel", "Nội dung nút")}
                  placeholder="Ví dụ: Xem ưu đãi"
                />
                <InputField
                  {...textProps("ctaHref", "Đường dẫn nút")}
                  inputMode="url"
                  placeholder="Ví dụ: /shop#catalog"
                  hint="Đường dẫn nội bộ hoặc HTTPS."
                />
              </div>
            </section>
            <section
              className="space-y-4 border-t pt-5"
              aria-labelledby={`${prefix}-schedule`}
            >
              <h3
                id={`${prefix}-schedule`}
                className="flex items-center gap-2 font-semibold"
              >
                <IconCalendar
                  className="text-primary size-4"
                  aria-hidden="true"
                />
                Lịch chạy & mức ưu tiên
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputField
                  {...textProps("startsAt", "Thời gian bắt đầu")}
                  type="datetime-local"
                />
                <InputField
                  {...textProps("endsAt", "Thời gian kết thúc")}
                  type="datetime-local"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                Để trống lịch chạy nếu muốn hiển thị không giới hạn thời gian.
              </p>
              <InputField
                {...textProps("priority", "Thứ tự ưu tiên")}
                type="number"
                step={1}
                hint="Số lớn hơn được hiển thị trước."
                className="h-11 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <label className="bg-muted/40 flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                <Checkbox
                  name="isActive"
                  checked={values.isActive}
                  disabled={pending}
                  onCheckedChange={(checked) => update("isActive", checked)}
                />
                <span className="space-y-1">
                  <span className="block text-sm font-semibold">
                    Kích hoạt chiến dịch ngay
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Chiến dịch đã bật sẽ hiển thị khi đến lịch chạy.
                  </span>
                </span>
              </label>
            </section>
            <div className="border-t pt-4">
              <Button
                type="submit"
                disabled={pending}
                className="h-11 w-full sm:w-auto"
              >
                {pending ? (
                  <IconLoader2
                    className="motion-safe:animate-spin"
                    aria-hidden="true"
                  />
                ) : initialData ? (
                  <IconCheck aria-hidden="true" />
                ) : (
                  <IconPlus aria-hidden="true" />
                )}
                {pending
                  ? "Đang lưu chiến dịch…"
                  : initialData
                    ? "Cập nhật chiến dịch"
                    : "Tạo chiến dịch"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <PromotionPreview
        title={values.title}
        body={values.body}
        placement={values.placement}
        imageUrl={values.imageUrl}
        ctaLabel={values.ctaLabel}
      />
    </div>
  );
}

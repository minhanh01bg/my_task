"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";

import { DateField, DropdownField, NumberStepper } from "@/components/kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveVoucherAction } from "@/app/admin/promotions/vouchers/actions";
import {
  describeVoucher,
  isVoucherType,
  type VoucherType,
} from "@/lib/vouchers/validate-voucher";
import type { VoucherActionResult } from "@/types/voucher";

const TYPE_OPTIONS = [
  {
    value: "percent",
    label: "Giảm theo %",
    description: "Giảm phần trăm tiền hàng, có thể đặt mức tối đa",
  },
  {
    value: "fixed",
    label: "Giảm số tiền cố định",
    description: "Trừ thẳng một số tiền vào tiền hàng",
  },
  {
    value: "freeship",
    label: "Miễn phí giao hàng",
    description: "Chỉ giảm phí ship, không giảm tiền hàng",
  },
] as const;

export interface VoucherFormValues {
  id: string;
  code: string;
  type: string;
  value: number;
  maxDiscount: number | null;
  minOrderTotal: number;
  maxUses: number | null;
  usedCount: number;
  /** "YYYY-MM-DD" theo giờ Việt Nam hoặc "". */
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

interface VoucherFormProps {
  initialData?: VoucherFormValues | null;
}

export function VoucherForm({ initialData }: VoucherFormProps) {
  const [state, formAction, pending] = useActionState<
    VoucherActionResult | null,
    FormData
  >(saveVoucherAction, null);

  const [code, setCode] = useState(initialData?.code ?? "");
  const [type, setType] = useState<VoucherType>(
    initialData && isVoucherType(initialData.type)
      ? initialData.type
      : "percent",
  );
  const [value, setValue] = useState(initialData?.value ?? 10);
  const [maxDiscount, setMaxDiscount] = useState(initialData?.maxDiscount ?? 0);
  const [minOrderTotal, setMinOrderTotal] = useState(
    initialData?.minOrderTotal ?? 0,
  );
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const summary = describeVoucher({
    type,
    value,
    maxDiscount: maxDiscount > 0 ? maxDiscount : null,
    minOrderTotal,
  });

  return (
    <form action={formAction} className="space-y-5">
      {initialData ? (
        <input type="hidden" name="id" value={initialData.id} />
      ) : null}

      {state ? (
        state.ok ? (
          <Alert variant="success" role="status" className="p-4">
            <Check aria-hidden="true" />
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive" className="p-4">
            <X aria-hidden="true" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="voucher-code">
            Mã giảm giá <span className="text-destructive">*</span>
          </Label>
          <Input
            id="voucher-code"
            name="code"
            required
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="VD: TRUNGTHU"
            maxLength={30}
            autoComplete="off"
            className="h-12 font-mono tracking-wider uppercase"
          />
          <p className="text-muted-foreground text-xs">
            3-30 ký tự: chữ không dấu, số, gạch ngang hoặc gạch dưới.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="voucher-type">Loại giảm giá</Label>
          <DropdownField
            id="voucher-type"
            name="type"
            aria-label="Loại giảm giá"
            value={type}
            onValueChange={(next) => {
              if (!next || !isVoucherType(next) || next === type) return;
              setType(next);
              // Doi loai thi dat lai gia tri mac dinh hop ly cho loai moi.
              setValue(next === "percent" ? 10 : next === "fixed" ? 10_000 : 0);
            }}
            options={TYPE_OPTIONS}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {type !== "freeship" ? (
          <div className="space-y-1.5">
            <Label htmlFor="voucher-value">
              {type === "percent" ? "Phần trăm giảm" : "Số tiền giảm"}
            </Label>
            <NumberStepper
              key={type}
              id="voucher-value"
              name="value"
              aria-label={
                type === "percent" ? "Phần trăm giảm" : "Số tiền giảm"
              }
              defaultValue={value}
              onChange={setValue}
              min={type === "percent" ? 1 : 0}
              max={type === "percent" ? 100 : undefined}
              step={type === "percent" ? 1 : 1000}
              unit={type === "percent" ? "%" : undefined}
              isCurrency={type === "fixed"}
            />
          </div>
        ) : null}

        {type !== "fixed" ? (
          <div className="space-y-1.5">
            <Label htmlFor="voucher-max-discount">
              {type === "freeship" ? "Giảm phí ship tối đa" : "Mức giảm tối đa"}
            </Label>
            <NumberStepper
              id="voucher-max-discount"
              name="maxDiscount"
              aria-label="Mức giảm tối đa"
              defaultValue={maxDiscount}
              onChange={setMaxDiscount}
              step={1000}
              isCurrency
            />
            <p className="text-muted-foreground text-xs">
              Để 0 nếu không giới hạn.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="voucher-min-order">Đơn tối thiểu</Label>
          <NumberStepper
            id="voucher-min-order"
            name="minOrderTotal"
            aria-label="Đơn tối thiểu"
            defaultValue={minOrderTotal}
            onChange={setMinOrderTotal}
            step={10000}
            isCurrency
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="voucher-max-uses">Tổng số lượt dùng</Label>
          <NumberStepper
            id="voucher-max-uses"
            name="maxUses"
            aria-label="Tổng số lượt dùng"
            defaultValue={initialData?.maxUses ?? 0}
            min={0}
            step={1}
            unit="lượt"
          />
          <p className="text-muted-foreground text-xs">
            Để 0 nếu không giới hạn
            {initialData
              ? ` · đã dùng ${initialData.usedCount.toLocaleString("vi-VN")} lượt`
              : ""}
            .
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Ngày bắt đầu (tùy chọn)</span>
          <DateField
            name="startsAt"
            aria-label="Ngày bắt đầu"
            defaultValue={initialData?.startsAt ?? ""}
            placeholder="Áp dụng ngay"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Ngày kết thúc (tùy chọn)</span>
          <DateField
            name="endsAt"
            aria-label="Ngày kết thúc"
            defaultValue={initialData?.endsAt ?? ""}
            placeholder="Không thời hạn"
          />
        </div>
      </div>

      <div className="border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            aria-label="Kích hoạt mã"
          />
          <span>{isActive ? "Đang bật" : "Đang tắt"}</span>
        </label>
        <input type="hidden" name="isActive" value={String(isActive)} />
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-mono font-bold">
            {code || "MÃ"}
          </span>
          : {summary}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending
            ? "Đang lưu…"
            : initialData
              ? "Cập nhật mã"
              : "Tạo mã giảm giá"}
        </Button>
        {initialData ? (
          <Button
            variant="outline"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/admin/promotions/vouchers" />}
          >
            Hủy sửa
          </Button>
        ) : null}
      </div>
    </form>
  );
}

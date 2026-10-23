"use client";

import { useActionState, useState } from "react";
import { Check, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveVoucherCustomerLimitAction } from "@/app/(management)/admin/promotions/vouchers/actions";
import { MAX_USES_PER_CUSTOMER_CAP } from "@/lib/vouchers/customer-limit";
import type { VoucherActionResult } from "@/types/voucher";

interface VoucherCustomerLimitFormProps {
  /** `null` = không giới hạn. */
  initialValue: number | null;
}

export function VoucherCustomerLimitForm({
  initialValue,
}: VoucherCustomerLimitFormProps) {
  const [state, formAction, pending] = useActionState<
    VoucherActionResult | null,
    FormData
  >(saveVoucherCustomerLimitAction, null);
  const [value, setValue] = useState(
    initialValue === null ? "" : String(initialValue),
  );

  return (
    <form action={formAction} className="space-y-4">
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

      <div className="max-w-xs space-y-1.5">
        <Label htmlFor="voucher-max-uses-per-customer">
          Số lần mỗi khách được dùng một mã (để trống = không giới hạn)
        </Label>
        <Input
          id="voucher-max-uses-per-customer"
          name="maxUsesPerCustomer"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_USES_PER_CUSTOMER_CAP}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Không giới hạn"
          className="h-12"
        />
        <p className="text-muted-foreground text-xs">
          Tính theo số điện thoại hoặc tài khoản của khách, áp dụng cho mọi mã
          khi đặt hàng online; đơn đã huỷ không tính.
        </p>
      </div>

      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Đang lưu…" : "Lưu giới hạn"}
      </Button>
    </form>
  );
}

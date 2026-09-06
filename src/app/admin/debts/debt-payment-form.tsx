"use client";

import { Bank, CheckCircle, HandCoins, Money } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownField } from "@/components/kit/dropdown-field";
import { formatVnd } from "@/lib/money";

import { recordDebtPaymentAction } from "./actions";

interface DebtPaymentFormProps {
  orderId: string;
  orderCode: string;
  customerName: string;
  balance: number;
}

export function DebtPaymentForm({
  orderId,
  orderCode,
  customerName,
  balance,
}: DebtPaymentFormProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        onClick={() => setOpen(true)}
      >
        <HandCoins aria-hidden="true" weight="bold" />
        Ghi nhận trả nợ
      </Button>
    );
  }

  return (
    <form
      className="bg-muted/45 grid w-full gap-3 rounded-2xl border p-3 sm:w-auto sm:min-w-[22rem]"
      action={async (formData) => {
        setSaving(true);
        setMessage("");
        const result = await recordDebtPaymentAction(formData);
        setSaving(false);

        if (result.ok) {
          setOpen(false);
          return;
        }

        setMessage(result.message);
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <p className="font-bold">{customerName}</p>
        <p className="text-muted-foreground text-sm">
          Đơn {orderCode} · Còn {formatVnd(balance)}
        </p>
      </div>
      <label className="grid gap-1.5 text-sm font-bold">
        Số tiền vừa nhận
        <Input
          name="amount"
          type="number"
          inputMode="numeric"
          min="1"
          max={balance}
          step="1000"
          defaultValue={balance}
          className="bg-background h-12 text-lg font-bold tabular-nums"
          autoFocus
          required
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold">
        Hình thức nhận
        <DropdownField
          name="method"
          defaultValue="cash"
          aria-label="Hình thức nhận"
          options={[
            {
              value: "cash",
              label: "Tiền mặt",
              description: "Nhận tiền trực tiếp",
              icon: <Money weight="duotone" className="size-5" />,
            },
            {
              value: "transfer",
              label: "Chuyển khoản",
              description: "Nhận qua ngân hàng",
              icon: <Bank weight="duotone" className="size-5" />,
            },
          ]}
        />
      </label>
      {message ? (
        <p role="alert" className="text-destructive text-sm font-semibold">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11 flex-1" disabled={saving}>
          <CheckCircle aria-hidden="true" weight="bold" />
          {saving
            ? "Đang lưu…"
            : balance === 0
              ? "Đã trả đủ"
              : "Xác nhận đã nhận"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={saving}
          onClick={() => setOpen(false)}
        >
          Hủy
        </Button>
      </div>
    </form>
  );
}

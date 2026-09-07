"use client";

import { useState } from "react";

import { DebtPanel } from "@/components/pos/debt-panel";
import { TransferPanel } from "@/components/pos/transfer-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrderPayloadPayment } from "@/lib/sync/types";
import type { BankAccount } from "@/lib/vietqr/types";
import { cn } from "@/lib/utils";
import type { CustomerOption } from "@/types/catalog";
import { Money, TouchButton } from "@/components/kit";

type Method = "cash" | "transfer" | "debt";

export interface PaymentResult {
  payments: OrderPayloadPayment[];
  customerId: string | null;
  received: number;
}

interface PaymentDialogProps {
  open: boolean;
  total: number;
  orderCode: string;
  bankAccount: BankAccount | null;
  onCancel: () => void;
  onConfirm: (result: PaymentResult) => void;
}

const CASH_DENOMINATIONS = [
  1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000,
] as const;

const TABS: Array<{ value: Method; label: string }> = [
  { value: "cash", label: "Tiền mặt" },
  { value: "transfer", label: "Chuyển khoản" },
  { value: "debt", label: "Ghi nợ" },
];

export function PaymentDialog({
  open,
  total,
  orderCode,
  bankAccount,
  onCancel,
  onConfirm,
}: PaymentDialogProps) {
  const [method, setMethod] = useState<Method>("cash");
  const [received, setReceived] = useState("");
  const [customer, setCustomer] = useState<CustomerOption | null>(null);

  if (!open) return null;

  const receivedValue = Math.round(Number(received) || 0);
  const change = Math.max(0, receivedValue - total);
  const cashEnough = receivedValue >= total;

  function addDenomination(amount: number) {
    setReceived(String(receivedValue + amount));
  }

  function confirmCash() {
    onConfirm({
      payments: [{ method: "cash", amount: total }],
      customerId: null,
      received: receivedValue,
    });
  }

  function confirmTransfer(receivedNow: boolean) {
    onConfirm({
      payments: [
        {
          method: "transfer",
          amount: total,
          receivedAt: receivedNow ? new Date().toISOString() : null,
        },
      ],
      customerId: null,
      received: total,
    });
  }

  function confirmDebt() {
    if (!customer) return;
    onConfirm({
      payments: [{ method: "debt", amount: total }],
      customerId: customer.id,
      received: 0,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        className="bg-background ring-foreground/10 max-h-[calc(100dvh-1.5rem)] w-full max-w-xl space-y-5 overflow-y-auto rounded-3xl p-4 shadow-2xl ring-1 sm:max-h-[calc(100dvh-2rem)] sm:p-6"
      >
        <div className="border-border bg-muted/40 flex items-baseline justify-between gap-4 rounded-2xl border p-4">
          <div>
            <p
              id="payment-dialog-title"
              className="text-muted-foreground text-sm font-semibold"
            >
              Thanh toán đơn hàng
            </p>
            <span className="text-lg font-bold">Khách phải trả</span>
          </div>
          <span
            data-testid="payment-total"
            className="text-primary text-right text-3xl font-black tabular-nums"
          >
            <Money amount={total} className="text-3xl" />
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Phương thức thanh toán"
          className="bg-muted grid grid-cols-3 gap-1 rounded-2xl p-1"
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={method === tab.value}
              onClick={() => setMethod(tab.value)}
              className={cn(
                "min-h-12 rounded-xl px-2 py-3 text-sm font-bold transition-colors sm:px-4 sm:text-base",
                method === tab.value
                  ? "bg-background text-primary shadow-sm ring-1 ring-black/5"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="cash-received" className="font-bold">
                  Tiền khách đưa
                </Label>
                {receivedValue > 0 ? (
                  <button
                    type="button"
                    onClick={() => setReceived("")}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring min-h-8 rounded-lg px-2 text-xs font-bold focus-visible:ring-2 focus-visible:outline-none"
                  >
                    Nhập lại từ đầu
                  </button>
                ) : null}
              </div>
              <Input
                id="cash-received"
                aria-label="Tiền khách đưa"
                type="number"
                min="0"
                autoFocus
                value={received}
                onChange={(event) => setReceived(event.target.value)}
                inputMode="numeric"
                className="border-primary/30 bg-primary/5 h-16 rounded-2xl text-right text-3xl font-black tabular-nums"
              />
            </div>

            <fieldset className="space-y-2.5">
              <legend className="text-muted-foreground text-sm font-semibold">
                Bấm để cộng thêm mệnh giá
              </legend>
              <div className="grid grid-cols-3 gap-2">
                {CASH_DENOMINATIONS.map((amount) => (
                  <TouchButton
                    key={amount}
                    type="button"
                    variant="outline"
                    aria-label={`Cộng ${amount.toLocaleString("vi-VN")} ₫`}
                    onClick={() => addDenomination(amount)}
                    className="hover:border-primary hover:bg-primary/10 active:bg-primary/20 min-h-12 rounded-xl px-1 font-black tabular-nums"
                  >
                    <span aria-hidden="true">
                      +<Money amount={amount} />
                    </span>
                  </TouchButton>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <TouchButton
                  type="button"
                  variant="outline"
                  className="min-h-12 rounded-xl font-bold"
                  onClick={() => setReceived(String(total))}
                >
                  Đúng số tiền
                </TouchButton>
                <p className="bg-muted text-muted-foreground flex min-h-12 items-center justify-center rounded-xl px-3 text-center text-xs font-semibold">
                  Có thể bấm nhiều tờ cùng mệnh giá
                </p>
              </div>
            </fieldset>

            <div
              aria-live="polite"
              className={cn(
                "flex items-baseline justify-between gap-4 rounded-2xl border p-4",
                cashEnough
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-amber-500/30 bg-amber-500/10",
              )}
            >
              <div>
                <span className="text-lg font-bold">Tiền thối lại</span>
                {!cashEnough ? (
                  <p className="text-muted-foreground text-xs font-semibold">
                    Còn thiếu <Money amount={total - receivedValue} />
                  </p>
                ) : null}
              </div>
              <span
                data-testid="payment-change"
                className="text-right text-4xl font-black tabular-nums sm:text-5xl"
              >
                <Money amount={change} size="display" />
              </span>
            </div>
          </div>
        ) : null}

        {method === "transfer" ? (
          <TransferPanel
            amount={total}
            description={orderCode}
            bankAccount={bankAccount}
          />
        ) : null}

        {method === "debt" ? (
          <DebtPanel selected={customer} onSelect={setCustomer} />
        ) : null}

        <div className="flex gap-2">
          <TouchButton
            type="button"
            variant="outline"
            className="h-14 flex-1"
            onClick={onCancel}
          >
            Huỷ
          </TouchButton>

          {method === "transfer" ? (
            <>
              <TouchButton
                type="button"
                variant="outline"
                className="h-14 flex-1"
                onClick={() => confirmTransfer(false)}
              >
                Chưa nhận được tiền
              </TouchButton>
              <TouchButton
                type="button"
                className="h-14 flex-1 text-lg"
                onClick={() => confirmTransfer(true)}
              >
                Đã nhận tiền
              </TouchButton>
            </>
          ) : (
            <TouchButton
              type="button"
              className="h-14 flex-1 text-lg"
              disabled={method === "cash" ? !cashEnough : !customer}
              onClick={method === "cash" ? confirmCash : confirmDebt}
            >
              Xác nhận
            </TouchButton>
          )}
        </div>
      </div>
    </div>
  );
}

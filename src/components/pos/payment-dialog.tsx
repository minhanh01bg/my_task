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

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background ring-foreground/10 w-full max-w-lg space-y-4 rounded-xl p-6 shadow-lg ring-1">
        <div className="flex items-baseline justify-between">
          <span className="text-lg">Khách phải trả</span>
          <span
            data-testid="payment-total"
            className="text-3xl font-bold tabular-nums"
          >
            <Money amount={total} className="text-3xl" />
          </span>
        </div>

        <div role="tablist" className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              type="button"
              aria-selected={method === tab.value}
              onClick={() => setMethod(tab.value)}
              className={cn(
                "flex-1 rounded-lg px-4 py-3 text-base",
                method === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {method === "cash" ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cash-received">Tiền khách đưa</Label>
              <Input
                id="cash-received"
                aria-label="Tiền khách đưa"
                type="number"
                min="0"
                autoFocus
                value={received}
                onChange={(event) => setReceived(event.target.value)}
                className="h-14 text-right text-2xl tabular-nums"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <TouchButton
                  key={amount}
                  type="button"
                  variant="outline"
                  onClick={() => setReceived(String(amount))}
                >
                  <Money amount={amount} />
                </TouchButton>
              ))}
              <TouchButton
                type="button"
                variant="outline"
                className="col-span-2"
                onClick={() => setReceived(String(total))}
              >
                Đúng số tiền
              </TouchButton>
            </div>

            <div className="bg-accent flex items-baseline justify-between rounded-lg p-4">
              <span className="text-lg">Tiền thối lại</span>
              <span
                data-testid="payment-change"
                className="text-5xl font-bold tabular-nums"
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

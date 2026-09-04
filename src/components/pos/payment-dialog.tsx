"use client";

import { useState } from "react";

import { DebtPanel } from "@/components/pos/debt-panel";
import { TransferPanel } from "@/components/pos/transfer-panel";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import type { OrderPayloadPayment } from "@/lib/sync/types";
import type { BankAccount } from "@/lib/vietqr/types";
import { cn } from "@/lib/utils";
import type { CustomerOption } from "@/types/catalog";

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
      <div className="w-full max-w-lg space-y-4 rounded-lg bg-background p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-lg">Khách phải trả</span>
          <span
            data-testid="payment-total"
            className="text-3xl font-bold tabular-nums"
          >
            {formatVnd(total)}
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
            <label className="block">
              <span className="text-sm text-muted-foreground">
                Tiền khách đưa
              </span>
              <input
                aria-label="Tiền khách đưa"
                type="number"
                min="0"
                autoFocus
                value={received}
                onChange={(event) => setReceived(event.target.value)}
                className="mt-1 w-full rounded border px-4 py-4 text-right text-2xl tabular-nums"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  onClick={() => setReceived(String(amount))}
                >
                  {formatVnd(amount)}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                className="col-span-2"
                onClick={() => setReceived(String(total))}
              >
                Đúng số tiền
              </Button>
            </div>

            <div className="flex items-baseline justify-between rounded-lg bg-accent p-4">
              <span className="text-lg">Tiền thối lại</span>
              <span
                data-testid="payment-change"
                className="text-5xl font-bold tabular-nums"
              >
                {formatVnd(change)}
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
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-1"
            onClick={onCancel}
          >
            Huỷ
          </Button>

          {method === "transfer" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-14 flex-1"
                onClick={() => confirmTransfer(false)}
              >
                Chưa nhận được tiền
              </Button>
              <Button
                type="button"
                className="h-14 flex-1 text-lg"
                onClick={() => confirmTransfer(true)}
              >
                Đã nhận tiền
              </Button>
            </>
          ) : (
            <Button
              type="button"
              className="h-14 flex-1 text-lg"
              disabled={method === "cash" ? !cashEnough : !customer}
              onClick={method === "cash" ? confirmCash : confirmDebt}
            >
              Xác nhận
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

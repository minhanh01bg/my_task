"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";

interface CashPaymentDialogProps {
  open: boolean;
  total: number;
  onCancel: () => void;
  onConfirm: (received: number) => void;
}

/** Menh gia hay gap o quay tap hoa. */
const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

export function CashPaymentDialog({
  open,
  total,
  onCancel,
  onConfirm,
}: CashPaymentDialogProps) {
  const [received, setReceived] = useState("");

  if (!open) return null;

  const receivedValue = Math.round(Number(received) || 0);
  const change = Math.max(0, receivedValue - total);
  const enough = receivedValue >= total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background w-full max-w-lg space-y-5 rounded-lg p-6">
        <div className="flex items-baseline justify-between">
          <span className="text-lg">Khách phải trả</span>
          <span
            data-testid="payment-total"
            className="text-3xl font-bold tabular-nums"
          >
            {formatVnd(total)}
          </span>
        </div>

        <label className="block">
          <span className="text-muted-foreground text-sm">Tiền khách đưa</span>
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

        <div className="bg-accent flex items-baseline justify-between rounded-lg p-4">
          <span className="text-lg">Tiền thối lại</span>
          <span
            data-testid="payment-change"
            className="text-5xl font-bold tabular-nums"
          >
            {formatVnd(change)}
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-1"
            onClick={onCancel}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            className="h-14 flex-1 text-lg"
            disabled={!enough}
            onClick={() => onConfirm(receivedValue)}
          >
            Xác nhận
          </Button>
        </div>
      </div>
    </div>
  );
}

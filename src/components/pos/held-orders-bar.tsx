"use client";

import { formatVnd } from "@/lib/money";
import {
  useHeldOrdersStore,
  type HeldOrder,
} from "@/stores/held-orders-store";

interface HeldOrdersBarProps {
  onResume: (order: HeldOrder) => void;
}

export function HeldOrdersBar({ onResume }: HeldOrdersBarProps) {
  const held = useHeldOrdersStore((state) => state.held);
  const resume = useHeldOrdersStore((state) => state.resume);

  if (held.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Đơn đang giữ:</span>
      {held.map((order, index) => (
        <button
          key={order.id}
          type="button"
          onClick={() => {
            const resumed = resume(order.id);
            if (resumed) onResume(resumed);
          }}
          className="rounded-full bg-accent px-4 py-2 text-sm"
        >
          #{index + 1} — {formatVnd(order.total)}
        </button>
      ))}
    </div>
  );
}

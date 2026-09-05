"use client";

import {
  ArrowClockwise,
  CloudArrowUp,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import {
  listQueuedOrders,
  QUEUE_CHANGED_EVENT,
  removeQueuedOrder,
} from "@/lib/sync/queue";
import type { QueuedOrder } from "@/lib/sync/types";

export function OfflineQueueManager() {
  const [orders, setOrders] = useState<QueuedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setOrders(await listQueuedOrders());
    setLoading(false);
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void refresh(), 0);
    window.addEventListener(QUEUE_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener(QUEUE_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  async function retry(order: QueuedOrder) {
    setSendingId(order.clientId);
    setMessage("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order.payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setMessage(body?.message ?? `Không gửi được đơn (${response.status})`);
        return;
      }
      await removeQueuedOrder(order.clientId);
      setMessage("Đã gửi đơn lên máy chủ thành công");
      await refresh();
    } catch {
      setMessage("Thiết bị vẫn chưa có kết nối mạng ổn định");
    } finally {
      setSendingId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-muted-foreground py-10 text-center">
        Đang đọc đơn chờ trên thiết bị…
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="bg-success/12 text-success flex size-14 items-center justify-center rounded-2xl">
          <CloudArrowUp aria-hidden="true" weight="fill" className="size-7" />
        </span>
        <p className="text-lg font-bold">Không có đơn bị kẹt</p>
        <p className="text-muted-foreground max-w-md text-sm">
          Tất cả đơn bán trên thiết bị này đã được gửi lên máy chủ.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p
          role="status"
          className="bg-info/10 text-info rounded-xl px-4 py-3 text-sm font-semibold"
        >
          {message}
        </p>
      ) : null}
      <ul className="space-y-3">
        {orders.map((order) => {
          const total = order.payload.payments.reduce(
            (sum, payment) => sum + payment.amount,
            0,
          );
          return (
            <li
              key={order.clientId}
              className="border-border bg-card rounded-2xl border p-4 shadow-sm"
            >
              <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-warning/15 text-warning-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold">
                      <WarningCircle aria-hidden="true" weight="fill" /> Chờ gửi
                    </span>
                    <span className="text-muted-foreground text-sm">
                      Tạo lúc {new Date(order.queuedAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <p className="font-mono text-xs break-all">
                    Mã thiết bị: {order.clientId}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {order.payload.lines
                      .map((line) => `${line.name} ×${line.quantity}`)
                      .join(", ")}
                  </p>
                  <p className="text-lg font-bold tabular-nums">
                    {formatVnd(total)}
                  </p>
                  {order.lastError ? (
                    <p
                      role="alert"
                      className="text-destructive bg-destructive/8 rounded-xl px-3 py-2 text-sm font-semibold"
                    >
                      Lỗi gần nhất: {order.lastError} · Đã thử {order.attempts}{" "}
                      lần
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-start gap-2 lg:justify-end">
                  <Button
                    type="button"
                    className="min-h-11"
                    disabled={sendingId !== null}
                    onClick={() => void retry(order)}
                  >
                    <ArrowClockwise aria-hidden="true" weight="bold" />
                    {sendingId === order.clientId ? "Đang gửi…" : "Gửi lại"}
                  </Button>
                  <ConfirmAction
                    action={async () => {
                      await removeQueuedOrder(order.clientId);
                      await refresh();
                    }}
                    triggerLabel="Xóa khỏi hàng đợi"
                    title="Xóa đơn chưa đồng bộ này?"
                    description="Chỉ xóa khi đã kiểm tra và xử lý đơn bằng cách khác. Thao tác này không thể khôi phục dữ liệu trên thiết bị."
                    confirmLabel="Tôi đã kiểm tra, xóa đơn"
                    triggerVariant="outline"
                    triggerClassName="text-destructive"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

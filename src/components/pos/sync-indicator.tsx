"use client";

import { useCallback, useEffect, useState } from "react";

import { flushQueue } from "@/lib/sync/flush";
import { QUEUE_CHANGED_EVENT, countQueuedOrders } from "@/lib/sync/queue";

const POLL_INTERVAL_MS = 15_000;

/**
 * Hien "N don cho dong bo" va tu day hang doi khi co mang lai.
 * KHONG hien loi do doa nguoi dung — chi la mot chi bao am tham.
 */
export function SyncIndicator() {
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    setPending(await countQueuedOrders());
  }, []);

  const flush = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushQueue();
    await refresh();
  }, [refresh]);

  useEffect(() => {
    const onFlush = () => void flush();
    const onQueueChanged = () => void refresh();

    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(onFlush, POLL_INTERVAL_MS);

    window.addEventListener("online", onFlush);
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      // Phai go dung tham chieu da gan — ban cu truyen mot ham moi vao
      // removeEventListener nen listener khong bao gio duoc go.
      window.removeEventListener("online", onFlush);
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueueChanged);
    };
  }, [flush, refresh]);

  if (pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="rounded-full bg-amber-100 px-4 py-2 text-sm text-amber-900"
    >
      {pending} đơn chờ đồng bộ — bấm để thử lại
    </button>
  );
}

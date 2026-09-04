"use client";

import { useCallback, useEffect, useState } from "react";

import { flushQueue } from "@/lib/sync/flush";
import { countQueuedOrders } from "@/lib/sync/queue";

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
    void refresh();

    const timer = setInterval(() => void flush(), POLL_INTERVAL_MS);
    window.addEventListener("online", () => void flush());

    return () => {
      clearInterval(timer);
      window.removeEventListener("online", () => void flush());
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

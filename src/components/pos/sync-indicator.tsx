"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudArrowUp } from "@phosphor-icons/react";

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
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void flush(), POLL_INTERVAL_MS);
    const handleOnline = () => void flush();
    window.addEventListener("online", handleOnline);

    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("online", handleOnline);
    };
  }, [flush, refresh]);

  if (pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-amber-700/20 bg-amber-100 px-4 py-2 text-sm font-extrabold text-amber-950 transition-colors hover:bg-amber-200 focus-visible:ring-3 focus-visible:outline-none"
    >
      <CloudArrowUp aria-hidden="true" weight="duotone" className="size-5" />
      {pending} đơn chờ đồng bộ — bấm để thử lại
    </button>
  );
}

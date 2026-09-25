"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudArrowUp } from "@phosphor-icons/react";

import { flushQueue } from "@/lib/sync/flush";
import { QUEUE_CHANGED_EVENT, countQueuedOrders } from "@/lib/sync/queue";

const POLL_INTERVAL_MS = 15_000;

/**
 * Hien "N don cho dong bo" va tu day hang doi khi co mang lai.
 * KHONG hien loi do doa nguoi dung — chi la mot chi bao am tham.
 */
export function SyncIndicator() {
  const [pending, setPending] = useState(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const count = await countQueuedOrders();
      if (isMountedRef.current && typeof window !== "undefined") {
        setPending(count);
      }
    } catch {
      // IndexedDB dong hoac moi truong bi huy luc teardown
    }
  }, []);

  const flush = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      await flushQueue();
      if (isMountedRef.current && typeof window !== "undefined") {
        await refresh();
      }
    } catch {
      // Bo qua loi flush nen
    }
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    const initial = setTimeout(() => {
      if (!cancelled && isMountedRef.current) void refresh();
    }, 0);
    const timer = setInterval(() => {
      if (!cancelled && isMountedRef.current) void flush();
    }, POLL_INTERVAL_MS);
    const handleOnline = () => {
      if (!cancelled && isMountedRef.current) void flush();
    };
    // Ban luc mat mang: hang doi doi ngay ca khi khong the flush.
    const handleQueueChanged = () => {
      if (!cancelled && isMountedRef.current) void refresh();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener(QUEUE_CHANGED_EVENT, handleQueueChanged);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, handleQueueChanged);
    };
  }, [flush, refresh]);

  if (pending === 0) return null;

  return (
    <button
      type="button"
      onClick={() => void flush()}
      className="focus-visible:ring-ring border-warning/30 bg-warning/15 text-warning-foreground hover:bg-warning/25 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-extrabold transition-colors focus-visible:ring-3 focus-visible:outline-none"
    >
      <CloudArrowUp aria-hidden="true" weight="duotone" className="size-5" />
      {pending} đơn chờ đồng bộ — bấm để thử lại
    </button>
  );
}

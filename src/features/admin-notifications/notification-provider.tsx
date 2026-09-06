"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  notificationListResponseSchema,
  type AdminNotificationDto,
} from "@/types/admin-notification";

interface NotificationContextValue {
  items: AdminNotificationDto[];
  unreadCount: number;
  cutoff: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markOne: (id: string) => Promise<void>;
  markAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function useAdminNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error("NotificationProvider chưa được khởi tạo");
  return value;
}

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<AdminNotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cutoff, setCutoff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const task = (async () => {
      try {
        const response = await fetch("/api/admin/notifications?limit=20", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Không thể tải thông báo");
        const parsed = notificationListResponseSchema.parse(
          await response.json(),
        );
        setItems(parsed.data.items);
        setUnreadCount(parsed.data.unreadCount);
        setCutoff(parsed.data.cutoff);
        setError(null);
      } catch {
        setError("Không thể tải thông báo. Hãy thử lại.");
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = task;
    return task;
  }, []);

  useEffect(() => {
    void refresh();
    let timer: ReturnType<typeof setInterval> | undefined;
    const syncTimer = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (document.visibilityState === "visible") {
        timer = setInterval(() => void refresh(), 15_000);
      }
    };
    const refetch = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    syncTimer();
    document.addEventListener("visibilitychange", syncTimer);
    window.addEventListener("focus", refetch);
    window.addEventListener("online", refetch);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", syncTimer);
      window.removeEventListener("focus", refetch);
      window.removeEventListener("online", refetch);
    };
  }, [refresh]);

  const mutate = useCallback(
    async (body: { id: string } | { allBefore: string }) => {
      const response = await fetch("/api/admin/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Không thể cập nhật thông báo");
      const payload = (await response.json()) as {
        data: { unreadCount: number };
      };
      setUnreadCount(payload.data.unreadCount);
    },
    [],
  );

  const markOne = useCallback(
    async (id: string) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id && !item.readAt
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await mutate({ id });
      } catch {
        void refresh();
      }
    },
    [mutate, refresh],
  );

  const markAll = useCallback(async () => {
    if (!cutoff) return;
    const previous = items;
    setItems((current) =>
      current.map((item) =>
        new Date(item.createdAt) <= new Date(cutoff) && !item.readAt
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
    setUnreadCount(0);
    try {
      await mutate({ allBefore: cutoff });
    } catch {
      setItems(previous);
      void refresh();
    }
  }, [cutoff, items, mutate, refresh]);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      cutoff,
      loading,
      error,
      refresh,
      markOne,
      markAll,
    }),
    [items, unreadCount, cutoff, loading, error, refresh, markOne, markAll],
  );
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

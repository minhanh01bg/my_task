"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, Loader2, X } from "lucide-react";

import type {
  CustomerNotificationDTO,
  CustomerNotificationsResponse,
} from "@/types/customer-notification";

export interface CustomerNotificationButtonProps {
  className?: string;
  placement?: "header" | "page";
}

export function CustomerNotificationButton({
  className = "",
  placement = "header",
}: CustomerNotificationButtonProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CustomerNotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef<Promise<void> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const task = (async () => {
      try {
        setError(null);
        const res = await fetch("/api/customer/notifications?limit=20", {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) {
          if (res.status === 401) {
            // Unauthenticated, hide or clear
            setItems([]);
            setUnreadCount(0);
            return;
          }
          throw new Error("Không thể tải thông báo");
        }
        const data: CustomerNotificationsResponse = await res.json();
        setItems(data.items);
        setUnreadCount(data.unreadCount);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Đã có lỗi xảy ra khi tải thông báo",
        );
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = task;
    return task;
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  // Focus close button when panel opens
  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
    }
  }, [open]);

  // Click outside and Escape key handling
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const markOne = async (id: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/customer/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch {
      // Reconcile on failure
      void fetchNotifications();
    }
  };

  const markAll = async () => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => ({ ...item, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);

    try {
      await fetch("/api/customer/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Reconcile on failure
      void fetchNotifications();
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void fetchNotifications();
          }
        }}
        className="border-border hover:bg-accent/12 focus-visible:ring-ring relative inline-flex min-h-11 items-center justify-center rounded-xl border px-3 font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Bell aria-hidden="true" className="size-5" />
        <span className="sr-only">Thông báo</span>
        {unreadCount > 0 && (
          <span
            data-testid="customer-notification-badge"
            className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.65rem] font-bold shadow-sm"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          aria-label="Hộp thư thông báo đơn hàng"
          className={
            placement === "page"
              ? "bg-popover text-popover-foreground border-border absolute top-12 right-0 z-50 max-h-[80dvh] w-80 overflow-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-xl sm:w-96"
              : "bg-popover text-popover-foreground border-border absolute top-full right-0 z-50 mt-2 max-h-[80dvh] w-80 overflow-auto rounded-2xl border p-4 shadow-2xl backdrop-blur-xl sm:w-96"
          }
        >
          <header className="mb-3 flex items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-base font-bold">Thông báo</h2>
              {unreadCount > 0 && (
                <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-semibold">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAll()}
                  className="hover:bg-muted text-primary flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold"
                >
                  <CheckCheck className="size-3.5" />
                  <span>Đọc tất cả</span>
                </button>
              )}
              <button
                ref={closeRef}
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className="hover:bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </header>

          {loading && items.length === 0 ? (
            <div
              role="status"
              className="text-muted-foreground flex flex-col items-center justify-center gap-2 p-8 text-sm"
            >
              <Loader2 className="size-5 animate-spin" />
              <p>Đang tải thông báo…</p>
            </div>
          ) : error && items.length === 0 ? (
            <div role="alert" className="p-4 text-center text-sm">
              <p className="text-destructive font-medium">{error}</p>
              <button
                type="button"
                onClick={() => void fetchNotifications()}
                className="text-primary mt-2 font-semibold hover:underline"
              >
                Thử lại
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground p-6 text-center text-sm">
              <Bell className="mx-auto mb-2 size-8 opacity-40" />
              <p className="font-semibold">Chưa có thông báo</p>
              <p className="mt-1 text-xs">
                Các cập nhật về đơn hàng của bạn sẽ hiển thị tại đây.
              </p>
            </div>
          ) : (
            <ul className="divide-border/40 space-y-1.5 divide-y">
              {items.map((item) => {
                const isRead = Boolean(item.readAt);
                return (
                  <li key={item.id} className="relative pt-1.5 first:pt-0">
                    <Link
                      href={item.href}
                      onClick={() => {
                        setOpen(false);
                        if (!isRead) void markOne(item.id);
                      }}
                      className={`focus-visible:ring-ring block rounded-xl p-3 pr-10 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                        isRead
                          ? "hover:bg-muted/60 opacity-80"
                          : "bg-primary/5 hover:bg-primary/10 font-medium"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {!isRead && (
                          <span
                            className="bg-primary size-2 shrink-0 rounded-full"
                            aria-hidden="true"
                          />
                        )}
                        <span className="text-foreground truncate font-bold">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                        {item.body}
                      </p>
                      <time
                        className="text-muted-foreground/80 mt-1.5 block text-[0.7rem]"
                        dateTime={String(item.createdAt)}
                      >
                        {new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(item.createdAt))}
                      </time>
                    </Link>
                    {!isRead && (
                      <button
                        type="button"
                        aria-label={`Đánh dấu đã đọc: ${item.title}`}
                        onClick={() => void markOne(item.id)}
                        className="hover:bg-muted text-muted-foreground hover:text-foreground absolute top-3 right-1.5 flex size-8 items-center justify-center rounded-lg"
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

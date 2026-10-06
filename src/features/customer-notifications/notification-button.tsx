"use client";

import { useEffect, useId, useRef } from "react";
import { Bell, CheckCheck, X } from "lucide-react";

import { NotificationList } from "@/components/kit/notification-list";

import { useCustomerNotifications } from "./use-customer-notifications";

export interface CustomerNotificationButtonProps {
  /** Chỉ gọi API thông báo khi đã biết là khách hàng đăng nhập. */
  enabled: boolean;
  className?: string;
  placement?: "header" | "page";
}

export function CustomerNotificationButton({
  enabled,
  className = "",
  placement = "header",
}: CustomerNotificationButtonProps) {
  const {
    open,
    setOpen,
    items,
    unreadCount,
    loading,
    loadingMore,
    nextCursor,
    error,
    refresh,
    retry,
    loadMore,
    markOne,
    markAll,
  } = useCustomerNotifications(enabled);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  }, [open, setOpen]);

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
            void refresh();
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
              ? "bg-popover text-popover-foreground border-border animate-in fade-in-0 zoom-in-95 absolute top-12 right-0 z-[100] flex max-h-[min(32rem,calc(100dvh-9rem))] w-[min(20rem,calc(100vw-1.5rem))] origin-top-right transform-gpu flex-col overflow-hidden rounded-2xl border p-3 shadow-2xl backdrop-blur-xl duration-200 ease-out will-change-[transform,opacity] sm:w-96"
              : "bg-popover text-popover-foreground border-border animate-in fade-in-0 zoom-in-95 absolute top-full right-0 z-[100] mt-2 flex max-h-[min(32rem,calc(100dvh-9rem))] w-[min(20rem,calc(100vw-1.5rem))] origin-top-right transform-gpu flex-col overflow-hidden rounded-2xl border p-3 shadow-2xl backdrop-blur-xl duration-200 ease-out will-change-[transform,opacity] sm:w-96"
          }
        >
          <header className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b pb-3">
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

          <div className="min-h-0 overflow-y-auto overscroll-contain">
            <NotificationList
              items={items}
              loading={loading}
              loadingMore={loadingMore}
              error={error}
              hasMore={Boolean(nextCursor)}
              onRetry={() => void retry()}
              onLoadMore={() => void loadMore()}
              onMarkRead={(id) => void markOne(id)}
              onNavigate={() => setOpen(false)}
              emptyDescription="Các cập nhật về đơn hàng của bạn sẽ hiển thị tại đây."
            />
          </div>
        </section>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "@phosphor-icons/react";

import { NotificationList } from "@/components/kit/notification-list";

import { useAdminNotifications } from "./notification-provider";

export function NotificationButton({
  placement = "desktop",
}: {
  placement?: "desktop" | "mobile";
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [desktopPosition, setDesktopPosition] = useState({ top: 0, left: 0 });
  const {
    items,
    unreadCount,
    loading,
    loadingMore,
    nextCursor,
    error,
    retry,
    loadMore,
    markOne,
    markAll,
  } = useAdminNotifications();

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open || placement !== "desktop") return;
    const positionPanel = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const panelWidth = Math.min(384, window.innerWidth - 24);
      const panelHeight = panelRef.current?.getBoundingClientRect().height ?? 0;
      setDesktopPosition({
        left: Math.max(
          12,
          Math.min(trigger.right + 12, window.innerWidth - panelWidth - 12),
        ),
        top: Math.max(
          12,
          Math.min(trigger.top, window.innerHeight - panelHeight - 12),
        ),
      });
    };
    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open, placement]);

  // Escape va bam ra ngoai dong panel, giong hanh vi popover chuan.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        (containerRef.current?.contains(target) ||
          panelRef.current?.contains(target))
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div
      ref={containerRef}
      className={
        placement === "desktop"
          ? `relative mb-4 ${open ? "z-[100]" : ""}`
          : `relative ${open ? "z-[100]" : ""}`
      }
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={
          placement === "desktop"
            ? "hover:bg-accent/12 focus-visible:ring-ring relative flex min-h-11 w-full items-center justify-start gap-3 rounded-xl px-3 py-2 text-sm font-semibold focus-visible:ring-3 focus-visible:outline-none"
            : "hover:bg-accent focus-visible:ring-ring relative flex size-11 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:outline-none"
        }
      >
        <Bell
          aria-hidden="true"
          className="size-5"
          weight={unreadCount ? "fill" : "regular"}
        />
        {placement === "desktop" ? <span>Thông báo</span> : null}
        {unreadCount > 0 && (
          <span
            className={
              placement === "desktop"
                ? "bg-destructive text-destructive-foreground min-w-5 rounded-full px-1.5 text-center text-xs"
                : "bg-destructive text-destructive-foreground absolute -top-0.5 -right-0.5 min-w-5 rounded-full px-1 text-center text-[0.65rem] font-bold"
            }
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <section
            ref={panelRef}
            id={panelId}
            aria-label="Thông báo quản trị"
            style={placement === "desktop" ? desktopPosition : undefined}
            className={
              placement === "desktop"
                ? "bg-popover text-popover-foreground animate-popover-enter fixed z-[100] flex max-h-[min(32rem,calc(100dvh-1.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border p-3 shadow-xl"
                : "bg-popover text-popover-foreground animate-popover-enter fixed top-18 right-3 z-[100] flex max-h-[min(32rem,calc(100dvh-9rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border p-3 shadow-xl"
            }
          >
            <header className="mb-2 flex shrink-0 items-center justify-between gap-2">
              <h2 className="font-heading font-bold">Thông báo</h2>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAll()}
                    className="hover:bg-muted min-h-11 rounded-lg px-2 text-sm font-semibold"
                  >
                    Đọc tất cả
                  </button>
                )}
                <button
                  ref={closeRef}
                  type="button"
                  aria-label="Đóng thông báo"
                  onClick={close}
                  className="hover:bg-muted flex size-11 items-center justify-center rounded-lg"
                >
                  <X aria-hidden="true" />
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
                emptyDescription="Đơn online mới và cảnh báo tồn kho sẽ hiện ở đây."
              />
            </div>
          </section>,
          document.body,
        )}
    </div>
  );
}

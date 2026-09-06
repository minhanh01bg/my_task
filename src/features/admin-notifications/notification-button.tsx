"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCircle, X } from "@phosphor-icons/react";

import { useAdminNotifications } from "./notification-provider";

export function NotificationButton() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { items, unreadCount, loading, error, refresh, markOne, markAll } =
    useAdminNotifications();

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  return (
    <div className="relative md:mb-4">
      <button
        type="button"
        aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`}
        aria-expanded={open}
        aria-controls="admin-notification-panel"
        onClick={() => setOpen((value) => !value)}
        className="hover:bg-accent/12 focus-visible:ring-ring relative flex min-h-11 w-full items-center justify-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold focus-visible:ring-3 focus-visible:outline-none md:justify-start"
      >
        <Bell
          aria-hidden="true"
          className="size-5"
          weight={unreadCount ? "fill" : "regular"}
        />
        <span className="hidden md:inline">Thông báo</span>
        {unreadCount > 0 && (
          <span
            className="bg-destructive text-destructive-foreground min-w-5 rounded-full px-1.5 text-center text-xs"
            data-testid="notification-badge"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <section
          id="admin-notification-panel"
          aria-label="Thông báo quản trị"
          className="bg-popover text-popover-foreground fixed inset-x-3 top-16 z-50 max-h-[75dvh] overflow-auto rounded-2xl border p-3 shadow-xl md:absolute md:inset-x-auto md:top-0 md:left-full md:ml-3 md:w-96"
        >
          <header className="mb-2 flex items-center justify-between gap-2">
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
                onClick={() => setOpen(false)}
                className="hover:bg-muted flex size-11 items-center justify-center rounded-lg"
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </header>
          {loading ? (
            <p role="status" className="text-muted-foreground p-4 text-sm">
              Đang tải thông báo…
            </p>
          ) : error ? (
            <div role="alert" className="p-4 text-sm">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                className="mt-2 font-semibold underline"
              >
                Thử lại
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">
              Chưa có thông báo.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id} className="relative">
                  <Link
                    href={item.href}
                    onClick={() => {
                      setOpen(false);
                      if (!item.readAt) void markOne(item.id);
                    }}
                    className={`focus-visible:ring-ring block rounded-xl p-3 pr-11 text-sm focus-visible:ring-3 focus-visible:outline-none ${item.readAt ? "hover:bg-muted" : "bg-primary/8 hover:bg-primary/12"}`}
                  >
                    <span className="block font-bold">{item.title}</span>
                    <span className="text-muted-foreground mt-1 block">
                      {item.body}
                    </span>
                    <time
                      className="text-muted-foreground mt-1 block text-xs"
                      dateTime={item.createdAt}
                    >
                      {new Intl.DateTimeFormat("vi-VN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(item.createdAt))}
                    </time>
                  </Link>
                  {!item.readAt && (
                    <button
                      type="button"
                      aria-label={`Đánh dấu đã đọc: ${item.title}`}
                      onClick={() => void markOne(item.id)}
                      className="hover:bg-background absolute top-2 right-1 flex size-11 items-center justify-center rounded-lg"
                    >
                      <CheckCircle aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

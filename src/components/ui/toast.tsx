"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "warning" | "info";

const ICONS: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  success: CircleCheck,
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
};

function isToastType(value: string | undefined): value is ToastType {
  return value !== undefined && value in ICONS;
}

/**
 * Boc Base UI Toast: Provider + Viewport (vung aria-live) + danh sach toast.
 * Dat mot lan o goc cay; noi can bao thi goi `useToast().add(...)`.
 */
function ToastProvider({
  children,
  timeout = 5000,
  limit = 3,
  ...props
}: ToastPrimitive.Provider.Props) {
  return (
    <ToastPrimitive.Provider timeout={timeout} limit={limit} {...props}>
      {children}
      <ToastPrimitive.Portal>
        <ToastPrimitive.Viewport
          data-slot="toast-viewport"
          aria-label="Thông báo"
          className="fixed right-4 bottom-4 z-[110] flex w-[calc(100vw-2rem)] flex-col-reverse gap-2 outline-none sm:w-96"
        >
          <ToastList />
        </ToastPrimitive.Viewport>
      </ToastPrimitive.Portal>
    </ToastPrimitive.Provider>
  );
}

function ToastList() {
  const { toasts } = ToastPrimitive.useToastManager();

  return toasts.map((toast) => {
    const Icon = isToastType(toast.type) ? ICONS[toast.type] : null;
    return (
      <ToastPrimitive.Root
        key={toast.id}
        toast={toast}
        data-slot="toast"
        className={cn(
          "bg-popover text-popover-foreground border-border relative flex w-full items-start gap-3 rounded-2xl border p-4 pr-12 shadow-xl transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] select-none data-ending-style:translate-y-4 data-ending-style:opacity-0 data-limited:hidden data-starting-style:translate-y-4 data-starting-style:opacity-0",
          "data-[type=error]:border-destructive/40 data-[type=info]:border-info/40 data-[type=success]:border-success/40 data-[type=warning]:border-warning/50",
        )}
      >
        {Icon ? (
          <Icon
            className={cn(
              "mt-0.5 size-5 shrink-0",
              toast.type === "success" && "text-success",
              toast.type === "error" && "text-destructive",
              toast.type === "warning" && "text-warning",
              toast.type === "info" && "text-info",
            )}
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <ToastPrimitive.Title
            data-slot="toast-title"
            className="text-sm font-bold"
          />
          <ToastPrimitive.Description
            data-slot="toast-description"
            className="text-muted-foreground text-sm"
          />
        </div>
        <ToastPrimitive.Close
          data-slot="toast-close"
          aria-label="Đóng thông báo"
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/30 absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-lg outline-none focus-visible:ring-3"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
    );
  });
}

interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  type?: ToastType;
  timeout?: number;
  priority?: "low" | "high";
}

/** API gon: `const toast = useToast(); toast.add({ title, type })`. */
function useToast() {
  const manager = ToastPrimitive.useToastManager();
  return React.useMemo(
    () => ({
      add: (options: ToastOptions) =>
        manager.add({
          ...options,
          priority:
            options.priority ?? (options.type === "error" ? "high" : "low"),
        }),
      close: (id?: string) => manager.close(id),
    }),
    [manager],
  );
}

export { ToastProvider, useToast };

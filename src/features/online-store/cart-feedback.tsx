"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";

import { useOnlineCart } from "./cart-context";

const AUTO_DISMISS_MS = 4000;

export function CartFeedback({ onViewCart }: { onViewCart?: () => void }) {
  const { feedback, dismissFeedback, openDrawer } = useOnlineCart();
  const handleViewCart = onViewCart || openDrawer;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!feedback) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      dismissFeedback();
    }, AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [feedback, dismissFeedback]);

  if (!feedback) return null;

  const isSuccess =
    feedback.status === "added" || feedback.status === "incremented";
  const isCapped = feedback.status === "capped";

  const Icon = isSuccess
    ? CheckCircle2
    : isCapped
      ? AlertTriangle
      : AlertCircle;

  const iconColor = isSuccess
    ? "text-emerald-600 dark:text-emerald-400"
    : isCapped
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";

  const messageText = (() => {
    if (feedback.message) return feedback.message;
    if (feedback.status === "added") {
      return `Đã thêm ${feedback.productName} vào giỏ hàng (SL: ${feedback.quantity})`;
    }
    if (feedback.status === "incremented") {
      return `Đã cập nhật số lượng ${feedback.productName} (SL: ${feedback.quantity})`;
    }
    if (feedback.status === "capped") {
      return `${feedback.productName}: Đã đạt số lượng tối đa`;
    }
    return `${feedback.productName} hiện không khả dụng`;
  })();

  return (
    <aside
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed right-0 bottom-4 left-0 z-50 flex justify-center px-4 sm:justify-end sm:px-6"
    >
      <div
        role="status"
        className="border-border bg-card text-card-foreground pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-200"
      >
        <Icon aria-hidden="true" className={`size-5 shrink-0 ${iconColor}`} />
        <div className="min-w-0 flex-1 text-sm font-medium">
          <p className="line-clamp-2">{messageText}</p>
          {isSuccess && (
            <div className="mt-1">
              <button
                type="button"
                onClick={handleViewCart}
                className="text-primary hover:text-primary/80 font-bold underline outline-none focus-visible:ring-2"
              >
                Xem giỏ
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={dismissFeedback}
          aria-label="Đóng thông báo"
          className="text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </aside>
  );
}

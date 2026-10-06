"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { invalidateStorefrontSession } from "@/features/online-store/storefront-session";
import { cn } from "@/lib/utils";

export function AdminLogoutButton({
  onLogout,
  className,
  compact = false,
}: {
  onLogout?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    if (isPending) return;

    setIsPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        throw new Error("Logout request failed");
      }

      invalidateStorefrontSession();
      onLogout?.();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Không thể đăng xuất. Vui lòng thử lại.");
      setIsPending(false);
    }
  }

  return (
    <div className={cn("relative space-y-1", className)}>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className={cn(
          "text-destructive hover:bg-destructive/10 focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60",
          compact &&
            "size-11 min-h-11 justify-center gap-0 px-0 xl:w-auto xl:gap-3 xl:px-3",
        )}
      >
        <SignOut aria-hidden="true" className="size-5 shrink-0" />
        <span className={compact ? "sr-only xl:not-sr-only" : undefined}>
          {isPending ? "Đang đăng xuất…" : "Đăng xuất"}
        </span>
      </button>
      {error ? (
        <p
          role="alert"
          className={cn(
            "text-destructive px-3 text-xs font-semibold",
            compact &&
              "bg-card absolute top-full right-0 z-50 w-64 rounded-lg border p-3 shadow-lg",
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

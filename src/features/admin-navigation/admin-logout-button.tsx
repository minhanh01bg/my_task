"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function AdminLogoutButton({
  onLogout,
  className,
}: {
  onLogout?: () => void;
  className?: string;
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

      onLogout?.();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("Không thể đăng xuất. Vui lòng thử lại.");
      setIsPending(false);
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        className="text-destructive hover:bg-destructive/10 focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
      >
        <SignOut aria-hidden="true" className="size-5 shrink-0" />
        {isPending ? "Đang đăng xuất…" : "Đăng xuất"}
      </button>
      {error ? (
        <p role="alert" className="text-destructive px-3 text-xs font-semibold">
          {error}
        </p>
      ) : null}
    </div>
  );
}

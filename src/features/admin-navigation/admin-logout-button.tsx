"use client";

import { IconLogout as SignOut } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
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

      setConfirmOpen(false);
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
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
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
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!isPending) setConfirmOpen(open);
        }}
      >
        <DialogContent initialFocus={cancelRef} showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Đăng xuất khỏi quản lý?</DialogTitle>
            <DialogDescription>
              Bạn sẽ cần đăng nhập lại để tiếp tục quản lý cửa hàng.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              ref={cancelRef}
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmOpen(false)}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={handleLogout}
            >
              {isPending ? "Đang đăng xuất…" : "Đăng xuất"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

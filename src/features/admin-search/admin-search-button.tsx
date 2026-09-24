"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

import { useAdminSearch } from "./admin-search-provider";

interface AdminSearchButtonProps {
  /** `desktop`: nut day du trong sidebar · `mobile`: nut vuong tren header. */
  placement?: "desktop" | "mobile";
  className?: string;
}

/** Nut kinh lup mo palette tim kiem — cung chuc nang voi Ctrl/Cmd+K. */
export function AdminSearchButton({
  placement = "desktop",
  className,
}: AdminSearchButtonProps) {
  const { openSearch } = useAdminSearch();
  const desktop = placement === "desktop";

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Tìm kiếm (Ctrl+K)"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "focus-visible:ring-ring relative flex items-center rounded-xl focus-visible:outline-none",
        desktop
          ? "hover:bg-accent/12 min-h-11 w-full justify-start gap-3 px-3 py-2 text-sm font-semibold focus-visible:ring-3"
          : "hover:bg-accent size-11 justify-center focus-visible:ring-2",
        className,
      )}
    >
      <MagnifyingGlass aria-hidden="true" className="size-5" />
      {desktop ? (
        <>
          <span>Tìm kiếm</span>
          <kbd
            aria-hidden="true"
            className="bg-muted text-muted-foreground ml-auto rounded-md border px-1.5 py-0.5 font-mono text-xs font-medium"
          >
            Ctrl K
          </kbd>
        </>
      ) : null}
    </button>
  );
}

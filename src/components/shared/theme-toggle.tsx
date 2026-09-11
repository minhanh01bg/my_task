"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {};

export function ThemeToggle({
  className = "",
  variant = "outline",
}: {
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button
        type="button"
        variant={variant}
        size="icon"
        aria-label="Đổi giao diện sáng/tối"
        className={`min-h-11 min-w-11 rounded-xl opacity-60 ${className}`}
        disabled
      >
        <Sun className="size-5" aria-hidden="true" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      aria-label={
        isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
      }
      title={
        isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"
      }
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`min-h-11 min-w-11 rounded-xl font-bold transition-transform active:scale-95 ${className}`}
    >
      {isDark ? (
        <Sun
          className="size-5 text-amber-400 transition-transform duration-300"
          aria-hidden="true"
        />
      ) : (
        <Moon
          className="size-5 text-slate-700 transition-transform duration-300"
          aria-hidden="true"
        />
      )}
      <span className="sr-only">
        {isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      </span>
    </Button>
  );
}

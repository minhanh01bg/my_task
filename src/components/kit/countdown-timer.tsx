"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

export interface CountdownTimerProps {
  targetDate: Date | string | number;
  expiredMessage?: string;
  className?: string;
}

function subscribe(callback: () => void) {
  const timer = setInterval(callback, 1000);
  return () => clearInterval(timer);
}

function getNowSnapshot() {
  return Date.now();
}

function getServerSnapshot() {
  return 0;
}

export function CountdownTimer({
  targetDate,
  expiredMessage = "Đã kết thúc",
  className,
}: CountdownTimerProps) {
  const now = useSyncExternalStore(
    subscribe,
    getNowSnapshot,
    getServerSnapshot,
  );

  const targetTime =
    typeof targetDate === "number"
      ? targetDate
      : new Date(targetDate).getTime();

  if (now === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 font-mono text-sm font-bold",
          className,
        )}
      >
        <span className="bg-foreground text-background flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5">
          --
        </span>
        <span>:</span>
        <span className="bg-foreground text-background flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5">
          --
        </span>
        <span>:</span>
        <span className="bg-foreground text-background flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5">
          --
        </span>
      </div>
    );
  }

  const diff = targetTime - now;

  if (diff <= 0) {
    return (
      <div
        className={cn("text-muted-foreground text-sm font-semibold", className)}
      >
        {expiredMessage}
      </div>
    );
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 font-mono text-xs font-bold sm:text-sm",
        className,
      )}
    >
      <div className="flex flex-col items-center">
        <span className="bg-foreground text-background flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 font-bold shadow-xs">
          {pad(hours)}
        </span>
        <span className="text-muted-foreground mt-0.5 font-sans text-[0.65rem]">
          Giờ
        </span>
      </div>
      <span className="text-foreground -mt-3.5 font-extrabold">:</span>
      <div className="flex flex-col items-center">
        <span className="bg-foreground text-background flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 font-bold shadow-xs">
          {pad(minutes)}
        </span>
        <span className="text-muted-foreground mt-0.5 font-sans text-[0.65rem]">
          Phút
        </span>
      </div>
      <span className="text-foreground -mt-3.5 font-extrabold">:</span>
      <div className="flex flex-col items-center">
        <span className="bg-primary text-primary-foreground flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 font-bold shadow-xs">
          {pad(seconds)}
        </span>
        <span className="text-muted-foreground mt-0.5 font-sans text-[0.65rem]">
          Giây
        </span>
      </div>
    </div>
  );
}

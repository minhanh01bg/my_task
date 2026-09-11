import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer bg-muted rounded-md", className)}
      {...props}
    />
  );
}

export function ProductCardSkeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "surface-panel relative flex flex-col overflow-hidden p-3 sm:p-4",
        className,
      )}
      {...props}
    >
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-1/3 rounded-full" />
        <Skeleton className="h-4 w-4/5 rounded-md" />
        <div className="mt-2 flex items-center justify-between pt-1">
          <Skeleton className="h-5 w-2/5 rounded-md" />
          <Skeleton className="size-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function CategoryPillSkeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <Skeleton className={cn("h-10 w-28 rounded-full", className)} {...props} />
  );
}

export interface TableSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rows?: number;
}

export function TableSkeleton({
  rows = 5,
  className,
  ...props
}: TableSkeletonProps) {
  return (
    <div
      className={cn(
        "surface-panel divide-border divide-y overflow-hidden",
        className,
      )}
      {...props}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          data-row-skeleton="true"
          className="flex items-center justify-between gap-4 p-4"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-4 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

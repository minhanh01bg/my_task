import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SearchParamValue = string | string[] | undefined;

export interface PaginationProps {
  /** Duong dan trang, vi du `/admin/orders`. */
  pathname: string;
  page: number;
  pageSize: number;
  total: number;
  /** Tham so hien tai — duoc giu nguyen, chi thay `page`. */
  searchParams?: Record<string, SearchParamValue>;
  label?: string;
  className?: string;
}

function buildHref(
  pathname: string,
  searchParams: Record<string, SearchParamValue>,
  page: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== "") query.append(key, item);
    }
  }
  query.set("page", String(page));
  return `${pathname}?${query.toString()}`;
}

const linkClass = cn(
  buttonVariants({ variant: "outline" }),
  "min-h-11 px-3 text-xs sm:px-4 sm:text-sm",
);

/** Phan trang bang link `?page=N` — khong can JS, dung duoc trong Server Component. */
export function Pagination({
  pathname,
  page,
  pageSize,
  total,
  searchParams = {},
  label = "Phân trang",
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);
  const hasPrev = current > 1;
  const hasNext = current < totalPages;

  return (
    <nav
      aria-label={label}
      className={cn(
        "border-border mt-4 flex items-center justify-between gap-2 border-t pt-4",
        className,
      )}
    >
      {hasPrev ? (
        <Link
          href={buildHref(pathname, searchParams, current - 1)}
          className={linkClass}
        >
          Trang trước
        </Link>
      ) : (
        <span
          role="link"
          aria-disabled="true"
          className={cn(linkClass, "opacity-45")}
        >
          Trang trước
        </span>
      )}
      <span className="text-center text-xs font-bold tabular-nums sm:text-sm">
        Trang {current}/{totalPages}
      </span>
      {hasNext ? (
        <Link
          href={buildHref(pathname, searchParams, current + 1)}
          className={linkClass}
        >
          Trang sau
        </Link>
      ) : (
        <span
          role="link"
          aria-disabled="true"
          className={cn(linkClass, "opacity-45")}
        >
          Trang sau
        </span>
      )}
    </nav>
  );
}

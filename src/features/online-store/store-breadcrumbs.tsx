import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { StoreCrumb } from "@/lib/seo/breadcrumbs";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb hiển thị (danh sách có thứ tự) — cùng dữ liệu với BreadcrumbList
 * JSON-LD. Mục cuối là trang hiện tại. Không dùng hook: dùng được ở cả server
 * và client component.
 */
export function StoreBreadcrumbs({
  crumbs,
  className,
}: {
  crumbs: readonly StoreCrumb[];
  className?: string;
}) {
  const lastIndex = crumbs.length - 1;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "text-muted-foreground text-xs font-medium sm:text-sm",
        className,
      )}
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {crumbs.map((crumb, index) => (
          <li
            key={`${index}-${crumb.path}`}
            className="inline-flex min-w-0 items-center gap-1.5"
          >
            {index === lastIndex ? (
              <span
                className="text-foreground truncate font-semibold"
                aria-current="page"
              >
                {crumb.name}
              </span>
            ) : (
              <>
                <Link
                  href={crumb.path}
                  className="hover:text-foreground transition-colors"
                >
                  {crumb.name}
                </Link>
                <ChevronRight
                  className="text-muted-foreground/50 size-3.5 shrink-0"
                  aria-hidden="true"
                />
              </>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

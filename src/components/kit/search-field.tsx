"use client";

import { Search, X } from "lucide-react";
import { forwardRef } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchFieldProps extends React.ComponentProps<"input"> {
  onClear?: () => void;
}

/**
 * O tim la duong vao chinh cua moi giao dich (Spec 1 muc 4) — nen no cao hon
 * moi o khac tren man hinh. forwardRef vi /pos giu ref de phim F2 focus vao.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  function SearchField({ className, onClear, value, ...props }, ref) {
    const hasText = String(value ?? "").length > 0;

    return (
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
        />
        <Input
          ref={ref}
          value={value}
          className={cn("h-14 pr-12 pl-12 text-xl", className)}
          {...props}
        />
        {hasText && onClear ? (
          <button
            type="button"
            aria-label="Xoá ô tìm"
            onClick={onClear}
            className="text-muted-foreground hover:bg-accent hover:text-foreground absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>
    );
  },
);

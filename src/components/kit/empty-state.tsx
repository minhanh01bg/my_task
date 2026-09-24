import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { PackageOpen } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

interface EmptyStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Icon trang tri (lucide); mac dinh la hop rong. */
  icon?: EmptyStateIcon;
  /** `compact` cho panel hep: gio hang POS, popover thong bao. */
  size?: "default" | "compact";
}

/** Bang trong khong noi len duoc dieu gi — luon thay bang mot loi dan. */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = PackageOpen,
  size = "default",
  className,
  ...props
}: EmptyStateProps) {
  const compact = size === "compact";

  return (
    <div
      data-slot="empty-state"
      data-size={size}
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-12",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center rounded-full",
          compact ? "size-12" : "size-16",
        )}
      >
        <Icon aria-hidden="true" className={compact ? "size-6" : "size-8"} />
      </span>
      <p className="text-foreground font-semibold">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

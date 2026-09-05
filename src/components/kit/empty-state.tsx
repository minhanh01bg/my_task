import { PackageOpen } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Bang trong khong noi len duoc dieu gi — luon thay bang mot loi dan. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <PackageOpen
        aria-hidden="true"
        className="text-muted-foreground size-10"
      />
      <p className="font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

import type { ComponentType, HTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

export interface ErrorStateProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  icon?: ErrorStateIcon;
  size?: "default" | "compact";
}

/**
 * Template chuẩn hiển thị trạng thái lỗi hoặc Error Boundary.
 * Cung cấp phản hồi thị giác nhất quán, hỗ trợ hành động thử lại (Retry CTA) và trợ năng.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Thử lại",
  action,
  icon: Icon = AlertCircle,
  size = "default",
  className,
  ...props
}: ErrorStateProps) {
  const compact = size === "compact";

  return (
    <div
      role="alert"
      data-slot="error-state"
      data-size={size}
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "gap-2.5 px-4 py-6" : "gap-3.5 px-6 py-12",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "bg-destructive/10 text-destructive flex items-center justify-center rounded-full shadow-xs",
          compact ? "size-12" : "size-16",
        )}
      >
        <Icon aria-hidden="true" className={compact ? "size-6" : "size-8"} />
      </span>

      <div className="space-y-1">
        <h2
          className={cn(
            "font-heading text-foreground font-bold tracking-tight",
            compact ? "text-base" : "text-xl sm:text-2xl",
          )}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={cn(
              "text-muted-foreground mx-auto max-w-md",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>

      {action ? (
        action
      ) : onRetry ? (
        <div className={compact ? "mt-1" : "mt-2"}>
          <Button
            type="button"
            variant="default"
            size={compact ? "sm" : "default"}
            onClick={onRetry}
            className="font-semibold shadow-xs"
          >
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-xl border px-4 py-3 text-sm has-[>svg]:grid-cols-[1.25rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-5 [&>svg]:translate-y-px [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive *:data-[slot=alert-description]:text-destructive/90",
        success:
          "border-success/30 bg-success/10 text-success *:data-[slot=alert-description]:text-foreground/80",
        warning:
          "border-warning/40 bg-warning/15 text-warning-foreground *:data-[slot=alert-description]:text-foreground/80",
        info: "border-info/30 bg-info/10 text-info *:data-[slot=alert-description]:text-foreground/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant = "default",
  role = "alert",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role={role}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 font-bold", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-sm font-medium", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle, alertVariants };

"use client";

import { useId } from "react";
import type { ComponentProps } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export interface CheckboxFieldProps extends Omit<
  ComponentProps<typeof Checkbox>,
  "className" | "children"
> {
  label: string;
  description?: string;
  variant?: "inline" | "card";
  className?: string;
}

/** Mẫu checkbox có nhãn, mô tả và vùng bấm dùng chung cho form/bộ lọc. */
export function CheckboxField({
  id,
  label,
  description,
  variant = "inline",
  className,
  disabled,
  "aria-describedby": ariaDescribedBy,
  ...props
}: CheckboxFieldProps) {
  const generatedId = useId();
  const checkboxId = id ?? generatedId;
  const labelId = `${checkboxId}-label`;
  const descriptionId = `${checkboxId}-description`;
  const describedBy =
    [ariaDescribedBy, description ? descriptionId : undefined]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <label
      htmlFor={checkboxId}
      data-slot="checkbox-field"
      data-disabled={disabled || undefined}
      className={cn(
        "group min-h-touch inline-flex cursor-pointer items-center gap-3 text-sm select-none",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        variant === "inline" && "py-2",
        variant === "card" &&
          "border-input bg-card hover:border-primary/60 hover:bg-primary/5 has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary/5 has-[[data-indeterminate]]:border-primary has-[[data-indeterminate]]:bg-primary/5 data-disabled:hover:border-input data-disabled:hover:bg-card w-full items-start rounded-xl border p-4 transition-colors duration-150 motion-reduce:transition-none",
        className,
      )}
    >
      <Checkbox
        {...props}
        id={checkboxId}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        className={cn(
          description && "mt-0.5",
          disabled && "data-disabled:opacity-100",
        )}
      />
      <span className="min-w-0 space-y-1">
        <span
          id={labelId}
          className="block font-medium [overflow-wrap:anywhere]"
        >
          {label}
        </span>
        {description ? (
          <span
            id={descriptionId}
            className="text-muted-foreground block text-xs leading-relaxed [overflow-wrap:anywhere]"
          >
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

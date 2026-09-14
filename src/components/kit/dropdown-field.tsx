"use client";

import { useMemo, type ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface DropdownFieldProps {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
  options: readonly DropdownOption[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  required?: boolean;
}

/** Dropdown mau dung chung cho form POS/admin/storefront. */
export function DropdownField({
  id,
  options,
  placeholder = "Chọn một mục",
  className,
  size,
  value,
  "aria-label": ariaLabel,
  ...props
}: DropdownFieldProps) {
  const items = useMemo(
    () => options.map(({ value, label }) => ({ value, label })),
    [options],
  );
  const controlledValue =
    value !== undefined ? (value === "" ? null : value) : undefined;

  return (
    <Select items={items} value={controlledValue} {...props}>
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        className={cn("w-full", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 ? (
          <div className="text-muted-foreground px-3 py-2 text-sm font-medium">
            Không có lựa chọn
          </div>
        ) : (
          options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.icon ? (
                <span
                  aria-hidden="true"
                  className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-lg"
                >
                  {option.icon}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col">
                <span>{option.label}</span>
                {option.description ? (
                  <span className="text-muted-foreground text-xs font-normal">
                    {option.description}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

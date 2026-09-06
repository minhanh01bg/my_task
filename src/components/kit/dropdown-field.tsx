"use client";

import type { ReactNode } from "react";

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
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | null) => void;
  options: readonly DropdownOption[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/** Dropdown mau dung chung cho form POS/admin. */
export function DropdownField({
  options,
  placeholder = "Chọn một mục",
  className,
  "aria-label": ariaLabel,
  ...props
}: DropdownFieldProps) {
  const items = options.map(({ value, label }) => ({ value, label }));

  return (
    <Select items={items} {...props}>
      <SelectTrigger aria-label={ariaLabel} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
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
        ))}
      </SelectContent>
    </Select>
  );
}

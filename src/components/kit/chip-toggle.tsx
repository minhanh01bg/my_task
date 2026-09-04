"use client";

import { TouchButton } from "@/components/kit/touch-button";
import { cn } from "@/lib/utils";

interface ChipToggleProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  className?: string;
}

/** Chip danh muc: bam lan nua de bo chon, nen la toggle chu khong phai tab. */
export function ChipToggle({
  label,
  selected,
  onToggle,
  className,
}: ChipToggleProps) {
  return (
    <TouchButton
      type="button"
      aria-pressed={selected}
      variant={selected ? "default" : "outline"}
      onClick={onToggle}
      className={cn("rounded-full px-5 text-base", className)}
    >
      {label}
    </TouchButton>
  );
}

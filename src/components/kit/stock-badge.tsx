import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Cua hang chua khai bao nguong rieng cho tung mat hang — dung mot so chung. */
export const LOW_STOCK_THRESHOLD = 5;

export type StockLevel = "out" | "low" | "ok";

export function stockLevel(
  stock: number,
  threshold: number = LOW_STOCK_THRESHOLD,
): StockLevel {
  if (stock <= 0) return "out";
  if (stock <= threshold) return "low";
  return "ok";
}

const LEVEL_CLASS: Record<StockLevel, string> = {
  out: "bg-destructive text-white",
  low: "bg-warning text-warning-foreground",
  ok: "bg-success text-success-foreground",
};

interface StockBadgeProps {
  stock: number;
  unit: string;
  threshold?: number;
  className?: string;
}

/**
 * Thu ngan phai liec la thay — nen ba muc dung ba mau khac han nhau,
 * khong chi khac sac do dam.
 */
export function StockBadge({
  stock,
  unit,
  threshold,
  className,
}: StockBadgeProps) {
  const level = stockLevel(stock, threshold);

  const label =
    level === "out"
      ? stock < 0
        ? `Hết hàng (${stock})`
        : "Hết hàng"
      : `Còn ${stock} ${unit}`;

  return (
    <Badge className={cn(LEVEL_CLASS[level], "tabular-nums", className)}>
      {label}
    </Badge>
  );
}

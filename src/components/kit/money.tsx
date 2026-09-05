import { formatVnd } from "@/lib/money";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "text-sm",
  base: "text-base",
  /** Cho "tien thoi lai (chu rat to)" — Spec 1 muc 5. */
  display: "text-5xl",
} as const;

interface MoneyProps {
  amount: number;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Moi cho hien tien deu di qua day, de dinh dang khong bao gio lech nhau. */
export function Money({ amount, size = "base", className }: MoneyProps) {
  const text = formatVnd(amount);

  return (
    <span
      aria-label={text}
      className={cn(
        "font-semibold tabular-nums",
        SIZES[size],
        size === "display" && "font-bold tracking-tight",
        className,
      )}
    >
      {text}
    </span>
  );
}

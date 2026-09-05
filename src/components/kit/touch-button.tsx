import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TouchButtonProps = React.ComponentProps<typeof Button>;

/**
 * Man hinh ban dung ca ngay tren tablet — moi nut phai cao it nhat
 * --touch-target (44px). Boc Button de khong ai quen dat lai chieu cao.
 */
export function TouchButton({ className, ...props }: TouchButtonProps) {
  return <Button className={cn("min-h-touch", className)} {...props} />;
}

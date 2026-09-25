import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ONLINE_ORDER_STATUS_LABELS,
  type OnlineOrderStatus,
} from "@/server/orders/online-order-status";

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  debt: "Ghi nợ",
  cancelled: "Đã hủy",
};

export const PAYMENT_STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  paid: "default",
  pending: "outline",
  debt: "secondary",
  cancelled: "destructive",
};

export const FULFILLMENT_STATUS_VARIANTS: Record<
  OnlineOrderStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  new: "default",
  confirmed: "secondary",
  preparing: "secondary",
  ready: "default",
  completed: "secondary",
  cancelled: "destructive",
};

export interface OrderStatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Badge hiển thị trạng thái thanh toán của đơn hàng (Đã thanh toán, Chờ thanh toán, Ghi nợ, Đã hủy).
 */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const label = PAYMENT_STATUS_LABELS[status] ?? status;
  const variant = PAYMENT_STATUS_VARIANTS[status] ?? "outline";

  return (
    <Badge
      variant={variant}
      className={cn("font-medium", className)}
      data-slot="payment-status-badge"
    >
      {label}
    </Badge>
  );
}

export interface FulfillmentStatusBadgeProps {
  status?: string | null;
  className?: string;
}

/**
 * Badge hiển thị tiến trình xử lý đơn hàng trực tuyến (Đơn mới, Đang chuẩn bị, Sẵn sàng giao, Hoàn tất, Đã hủy).
 */
export function FulfillmentStatusBadge({
  status,
  className,
}: FulfillmentStatusBadgeProps) {
  if (!status) return null;

  const typedStatus = status as OnlineOrderStatus;
  const label = ONLINE_ORDER_STATUS_LABELS[typedStatus] ?? status;
  const variant = FULFILLMENT_STATUS_VARIANTS[typedStatus] ?? "secondary";

  return (
    <Badge
      variant={variant}
      className={cn("font-medium", className)}
      data-slot="fulfillment-status-badge"
    >
      {label}
    </Badge>
  );
}

export interface ChannelBadgeProps {
  channel: string;
  className?: string;
}

/**
 * Badge hiển thị kênh bán hàng (Tại quầy vs Trực tuyến).
 */
export function ChannelBadge({ channel, className }: ChannelBadgeProps) {
  const isOnline = channel === "online";
  const label = isOnline ? "Trực tuyến" : "Tại quầy";

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        isOnline
          ? "border-primary/30 bg-primary/5 text-primary"
          : "border-border text-muted-foreground",
        className,
      )}
      data-slot="channel-badge"
    >
      {label}
    </Badge>
  );
}

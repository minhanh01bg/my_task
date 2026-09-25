import Link from "next/link";

import { Money } from "@/components/kit/money";
import { Badge } from "@/components/ui/badge";
import {
  ONLINE_ORDER_STATUS_LABELS,
  type OnlineOrderStatus,
} from "@/server/orders/online-order-status";

const ORDER_STATUS_LABELS: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  debt: "Ghi nợ",
  cancelled: "Đã hủy",
};

export function CustomerOrderCard({
  order,
  href,
}: {
  order: {
    code: string;
    createdAt: Date;
    total: number;
    status: string;
    fulfillmentStatus: string | null;
  };
  href: string;
}) {
  const fulfillmentLabel = order.fulfillmentStatus
    ? (ONLINE_ORDER_STATUS_LABELS[
        order.fulfillmentStatus as OnlineOrderStatus
      ] ?? order.fulfillmentStatus)
    : null;

  const paymentLabel = ORDER_STATUS_LABELS[order.status] ?? order.status;

  return (
    <li>
      <Link
        href={href}
        className="card-interactive surface-panel border-border/80 hover:border-primary/50 block rounded-2xl border p-5 transition-colors"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <strong className="font-heading text-foreground font-bold">
            {order.code}
          </strong>
          <span className="text-primary font-mono text-base font-bold">
            <Money amount={order.total} />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {fulfillmentLabel ? (
            <Badge variant="secondary" className="font-medium">
              {fulfillmentLabel}
            </Badge>
          ) : null}
          <Badge
            variant={order.status === "cancelled" ? "destructive" : "outline"}
            className="font-medium"
          >
            {paymentLabel}
          </Badge>
          <span className="text-muted-foreground ml-auto text-xs">
            {order.createdAt.toLocaleDateString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </span>
        </div>
      </Link>
    </li>
  );
}

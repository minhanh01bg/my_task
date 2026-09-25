import Link from "next/link";

import {
  FulfillmentStatusBadge,
  Money,
  OrderStatusBadge,
} from "@/components/kit";

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
          <FulfillmentStatusBadge status={order.fulfillmentStatus} />
          <OrderStatusBadge status={order.status} />
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

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import {
  EmptyState,
  FulfillmentStatusBadge,
  Money,
  OrderStatusBadge,
} from "@/components/kit";
import type { DashboardOnlineOrder } from "@/server/admin/dashboard";

import { DashboardListCard } from "./dashboard-list-card";

const TIME_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

export function RecentOnlineOrders({
  orders,
}: {
  orders: DashboardOnlineOrder[];
}) {
  return (
    <DashboardListCard
      id="dashboard-online-orders"
      title="Đơn online mới nhất"
      viewAllHref="/admin/orders?channel=online"
      viewAllLabel="đơn online"
    >
      {orders.length === 0 ? (
        <EmptyState
          size="compact"
          icon={ShoppingBag}
          title="Chưa có đơn online nào"
          description="Đơn khách đặt trên cửa hàng online sẽ hiện ở đây."
        />
      ) : (
        <ul className="divide-y">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <div className="min-w-0 space-y-0.5">
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="hover:text-primary focus-visible:ring-ring rounded font-bold break-all underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                >
                  {order.code}
                </Link>
                <p className="text-muted-foreground text-sm">
                  {order.contactName ? (
                    <span>{order.contactName}</span>
                  ) : (
                    <span>Khách online</span>
                  )}
                  <span aria-hidden="true"> · </span>
                  <time dateTime={order.createdAt.toISOString()}>
                    {TIME_FORMATTER.format(order.createdAt)}
                  </time>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {order.status === "cancelled" ? (
                  <OrderStatusBadge status="cancelled" />
                ) : (
                  <FulfillmentStatusBadge status={order.fulfillmentStatus} />
                )}
                <Money amount={order.total} size="sm" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </DashboardListCard>
  );
}

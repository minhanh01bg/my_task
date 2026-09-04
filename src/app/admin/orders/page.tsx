import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db/prisma";

import { cancelOrderAction } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  debt: "Ghi nợ",
  cancelled: "Đã huỷ",
};

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      items: { select: { nameSnapshot: true, quantity: true, unit: true } },
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Đơn hàng</h1>

      <ul className="divide-y">
        {orders.map((order) => (
          <li key={order.id} className="flex items-start justify-between py-3">
            <div>
              <p className="font-medium">
                {order.code}
                {order.hasStockWarning ? (
                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                    Tồn âm
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {order.items
                  .map((item) => `${item.nameSnapshot} ×${item.quantity}`)
                  .join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">
                {STATUS_LABEL[order.status] ?? order.status}
                {order.customer ? ` — ${order.customer.name}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold tabular-nums">
                {formatVnd(order.total)}
              </span>
              {order.status !== "cancelled" ? (
                <form action={cancelOrderAction.bind(null, order.id)}>
                  <button
                    type="submit"
                    className="text-sm text-red-600 hover:underline"
                  >
                    Huỷ đơn
                  </button>
                </form>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  paid: "default",
  pending: "secondary",
  debt: "outline",
  cancelled: "outline",
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

      <Card>
        <CardHeader>
          <CardTitle>Gần đây ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {orders.map((order) => (
              <li
                key={order.id}
                className="flex items-start justify-between py-3"
              >
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="hover:text-primary focus-visible:ring-ring rounded underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {order.code}
                    </Link>
                    <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </Badge>
                    {order.hasStockWarning ? (
                      <Badge variant="destructive">Tồn âm</Badge>
                    ) : null}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {order.items
                      .map((item) => `${item.nameSnapshot} ×${item.quantity}`)
                      .join(", ")}
                  </p>
                  {order.customer ? (
                    <p className="text-muted-foreground text-sm">
                      {order.customer.name}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold tabular-nums">
                    {formatVnd(order.total)}
                  </span>
                  {order.status !== "cancelled" ? (
                    <form action={cancelOrderAction.bind(null, order.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        className="text-destructive"
                      >
                        Huỷ đơn
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
import Link from "next/link";

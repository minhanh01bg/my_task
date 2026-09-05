import Link from "next/link";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/db/prisma";

import { cancelOrderAction } from "./actions";
import { Money, PageHeader } from "@/components/kit";

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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const { status = "", date = "" } = await searchParams;
  const start = date ? new Date(`${date}T00:00:00`) : null;
  const end = date ? new Date(`${date}T23:59:59.999`) : null;
  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(start && end ? { createdAt: { gte: start, lte: end } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      customer: { select: { name: true } },
      items: { select: { nameSnapshot: true, quantity: true, unit: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn hàng"
        description="Mọi đơn đã bán, tra lại theo mã đơn hoặc ngày."
      />

      <form className="surface-panel flex flex-wrap items-end gap-3 p-4">
        <label className="flex min-w-44 flex-1 flex-col gap-1.5 text-sm font-bold">
          Trạng thái
          <select
            name="status"
            defaultValue={status}
            className="border-input bg-background h-11 rounded-xl border px-3 font-medium"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="paid">Đã thanh toán</option>
            <option value="debt">Ghi nợ</option>
            <option value="cancelled">Đã hủy</option>
            <option value="pending">Chờ thanh toán</option>
          </select>
        </label>
        <label className="flex min-w-44 flex-1 flex-col gap-1.5 text-sm font-bold">
          Ngày bán
          <input
            name="date"
            type="date"
            defaultValue={date}
            className="border-input bg-background h-11 rounded-xl border px-3 font-medium"
          />
        </label>
        <Button type="submit">Lọc đơn hàng</Button>
        {status || date ? (
          <Button variant="ghost" render={<Link href="/admin/orders" />}>
            Xóa lọc
          </Button>
        ) : null}
      </form>

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
                    <Money amount={order.total} />
                  </span>
                  {order.status !== "cancelled" ? (
                    <ConfirmAction
                      action={cancelOrderAction.bind(null, order.id)}
                      triggerLabel="Hủy đơn"
                      title={`Hủy đơn ${order.code}?`}
                      description="Tồn kho của các sản phẩm trong đơn sẽ được hoàn lại. Thao tác này không thể hoàn tác."
                      confirmLabel="Xác nhận hủy đơn"
                      triggerClassName="text-destructive"
                    />
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

import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db/prisma";

import { settleDebtAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const debts = await prisma.order.findMany({
    where: { status: "debt" },
    orderBy: { createdAt: "asc" },
    include: { customer: { select: { name: true, phone: true } } },
  });

  const byCustomer = new Map<string, { name: string; total: number }>();
  for (const order of debts) {
    const key = order.customerId ?? "unknown";
    const current = byCustomer.get(key) ?? {
      name: order.customer?.name ?? "Khách lẻ",
      total: 0,
    };
    byCustomer.set(key, {
      name: current.name,
      total: current.total + order.total,
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Công nợ</h1>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-medium">Tổng nợ theo khách</h2>
        {byCustomer.size === 0 ? (
          <p className="text-muted-foreground">Không ai đang nợ</p>
        ) : (
          <ul className="divide-y">
            {[...byCustomer.values()].map((row) => (
              <li key={row.name} className="flex justify-between py-2">
                <span>{row.name}</span>
                <span className="font-semibold tabular-nums">
                  {formatVnd(row.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-medium">Từng đơn nợ</h2>
        <ul className="divide-y">
          {debts.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="font-medium">{order.code}</p>
                <p className="text-sm text-muted-foreground">
                  {order.customer?.name ?? "Khách lẻ"}
                  {order.customer?.phone ? ` — ${order.customer.phone}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-semibold tabular-nums">
                  {formatVnd(order.total)}
                </span>
                <form action={settleDebtAction.bind(null, order.id)}>
                  <button
                    type="submit"
                    className="text-sm text-green-700 hover:underline"
                  >
                    Khách trả tiền
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr";

import { Money, PageHeader } from "@/components/kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/db/prisma";

import { DebtPaymentForm } from "./debt-payment-form";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const debts = await prisma.order.findMany({
    where: { status: "debt" },
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { name: true, phone: true } },
      payments: {
        where: {
          method: { in: ["cash", "transfer"] },
          receivedAt: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          method: true,
          receivedAt: true,
          createdAt: true,
        },
      },
    },
  });

  const rows = debts.map((order) => {
    const paid = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    return { ...order, paid, balance: Math.max(0, order.total - paid) };
  });

  const byCustomer = new Map<string, { name: string; balance: number }>();
  for (const order of rows) {
    const key = order.customerId ?? "unknown";
    const current = byCustomer.get(key) ?? {
      name: order.customer?.name ?? "Khách lẻ",
      balance: 0,
    };
    byCustomer.set(key, {
      name: current.name,
      balance: current.balance + order.balance,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Công nợ"
        description="Ghi nhận từng lần khách trả. Đơn chỉ tự tất toán khi đã nhận đủ tiền."
      />

      <Card>
        <CardHeader>
          <CardTitle>Tổng còn nợ theo khách</CardTitle>
        </CardHeader>
        <CardContent>
          {byCustomer.size === 0 ? (
            <p className="text-muted-foreground">Không ai đang nợ</p>
          ) : (
            <ul className="divide-y">
              {[...byCustomer.entries()].map(([key, row]) => (
                <li key={key} className="flex justify-between gap-4 py-3">
                  <span className="font-semibold">{row.name}</span>
                  <span className="text-destructive font-bold tabular-nums">
                    <Money amount={row.balance} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Từng đơn nợ</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map((order) => (
              <li
                key={order.id}
                className="grid gap-4 py-5 lg:grid-cols-[1fr_auto]"
              >
                <div className="space-y-3">
                  <div>
                    <p className="font-bold">{order.code}</p>
                    <p className="text-muted-foreground text-sm">
                      {order.customer?.name ?? "Khách lẻ"}
                      {order.customer?.phone
                        ? ` — ${order.customer.phone}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span>
                      Tổng đơn:{" "}
                      <strong>
                        <Money amount={order.total} />
                      </strong>
                    </span>
                    <span>
                      Đã trả:{" "}
                      <strong className="text-success">
                        <Money amount={order.paid} />
                      </strong>
                    </span>
                    <span>
                      Còn nợ:{" "}
                      <strong className="text-destructive">
                        <Money amount={order.balance} />
                      </strong>
                    </span>
                  </div>
                  {order.payments.length > 0 ? (
                    <details className="group max-w-xl">
                      <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                        <ClockCounterClockwise
                          aria-hidden="true"
                          weight="bold"
                        />
                        Lịch sử {order.payments.length} lần trả
                      </summary>
                      <ul className="border-border ml-2 border-l pl-4">
                        {order.payments.map((payment) => (
                          <li
                            key={payment.id}
                            className="flex justify-between gap-4 py-2 text-sm"
                          >
                            <span className="text-muted-foreground">
                              {(
                                payment.receivedAt ?? payment.createdAt
                              ).toLocaleString("vi-VN")}{" "}
                              ·{" "}
                              {payment.method === "cash"
                                ? "Tiền mặt"
                                : "Chuyển khoản"}
                            </span>
                            <strong>
                              <Money amount={payment.amount} />
                            </strong>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                <div className="flex items-start lg:justify-end">
                  <DebtPaymentForm
                    orderId={order.id}
                    orderCode={order.code}
                    customerName={order.customer?.name ?? "Khách lẻ"}
                    balance={order.balance}
                  />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

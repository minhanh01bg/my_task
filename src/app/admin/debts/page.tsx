import {
  CheckCircle,
  ClockCounterClockwise,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { Money, PageHeader } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/db/prisma";
import { settledDebtWhere } from "@/server/debts/debt-filters";

import { DebtPaymentForm } from "./debt-payment-form";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const paymentHistory = {
    where: {
      method: { in: ["cash", "transfer"] },
      receivedAt: { not: null },
    },
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      amount: true,
      method: true,
      receivedAt: true,
      createdAt: true,
    },
  };

  const [debts, settledDebts] = await Promise.all([
    prisma.order.findMany({
      where: { status: "debt" },
      orderBy: { createdAt: "asc" },
      include: {
        customer: { select: { name: true, phone: true } },
        payments: paymentHistory,
      },
    }),
    prisma.order.findMany({
      where: settledDebtWhere,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        customer: { select: { name: true, phone: true } },
        payments: paymentHistory,
      },
    }),
  ]);

  const rows = debts.map((order) => {
    const paid = order.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    return { ...order, paid, balance: Math.max(0, order.total - paid) };
  });

  const settledRows = settledDebts.map((order) => ({
    ...order,
    paid: order.payments.reduce((sum, payment) => sum + payment.amount, 0),
    settledAt: order.payments[0]?.receivedAt ?? order.payments[0]?.createdAt,
  }));

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
        description="Theo dõi rõ ai còn nợ và những đơn đã trả đủ. Mỗi lần khách trả đều được lưu lại."
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
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Đơn còn nợ</CardTitle>
            <p className="text-muted-foreground text-sm">
              Cần tiếp tục thu tiền
            </p>
          </div>
          <Badge
            variant="destructive"
            className="min-h-7 px-3 text-sm font-bold"
          >
            <WarningCircle aria-hidden="true" weight="fill" />
            {rows.length} đơn còn nợ
          </Badge>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="bg-success/10 text-success flex items-center gap-3 rounded-2xl p-4 font-semibold">
              <CheckCircle
                aria-hidden="true"
                className="size-6"
                weight="fill"
              />
              Hiện không còn đơn nào chưa trả đủ.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((order) => (
                <li
                  key={order.id}
                  className="grid gap-4 py-5 lg:grid-cols-[1fr_auto]"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{order.code}</p>
                      <Badge variant="destructive" className="font-bold">
                        Còn nợ
                      </Badge>
                    </div>
                    <div>
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
          )}
        </CardContent>
      </Card>

      <Card className="border-success/20">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Đã trả xong</CardTitle>
            <p className="text-muted-foreground text-sm">
              20 đơn công nợ đã tất toán gần nhất
            </p>
          </div>
          <Badge className="bg-success/12 text-success min-h-7 px-3 text-sm font-bold">
            <CheckCircle aria-hidden="true" weight="fill" />
            {settledRows.length} đơn đã trả đủ
          </Badge>
        </CardHeader>
        <CardContent>
          {settledRows.length === 0 ? (
            <p className="text-muted-foreground py-2">
              Chưa có đơn công nợ nào được trả xong.
            </p>
          ) : (
            <ul className="divide-y">
              {settledRows.map((order) => (
                <li key={order.id} className="space-y-3 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{order.code}</p>
                        <Badge className="bg-success/12 text-success font-bold">
                          <CheckCircle aria-hidden="true" weight="fill" />
                          Đã trả đủ
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {order.customer?.name ?? "Khách lẻ"}
                        {order.customer?.phone
                          ? ` — ${order.customer.phone}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-muted-foreground text-sm">
                        Tổng đã thanh toán
                      </p>
                      <p className="text-success text-lg font-bold tabular-nums">
                        <Money amount={order.paid} />
                      </p>
                    </div>
                  </div>

                  {order.settledAt ? (
                    <p className="text-sm font-semibold">
                      Trả đủ lúc {order.settledAt.toLocaleString("vi-VN")}
                    </p>
                  ) : null}

                  <details className="group max-w-xl">
                    <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
                      <ClockCounterClockwise aria-hidden="true" weight="bold" />
                      Xem {order.payments.length} lần thanh toán
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

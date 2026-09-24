import {
  CheckCircle,
  ClockCounterClockwise,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { CircleCheck, History, Smile } from "lucide-react";

import { EmptyState, Money, PageHeader, Pagination } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listDebts,
  listSettledDebts,
  SETTLED_DEBTS_LIMIT,
  summarizeOpenDebts,
  type OpenDebtItem,
} from "@/server/admin/list-debts";
import { parsePageParam } from "@/server/admin/pagination";

import { DebtPaymentForm } from "./debt-payment-form";

export const dynamic = "force-dynamic";

function debtCustomerLabel(order: OpenDebtItem): string {
  const name = order.customer?.name ?? "Khách lẻ";
  return order.customer?.phone ? `${name} — ${order.customer.phone}` : name;
}

function DebtAmounts({ order }: { order: OpenDebtItem }) {
  return (
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
  );
}

function PaymentHistory({ order }: { order: OpenDebtItem }) {
  if (order.payments.length === 0) return null;
  return (
    <details className="group max-w-xl">
      <summary className="text-muted-foreground hover:text-foreground flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold">
        <ClockCounterClockwise aria-hidden="true" weight="bold" />
        Lịch sử {order.payments.length} lần trả
      </summary>
      <ul className="border-border ml-2 border-l pl-4">
        {order.payments.map((payment) => (
          <li
            key={payment.id}
            className="flex justify-between gap-4 py-2 text-sm"
          >
            <span className="text-muted-foreground">
              {(payment.receivedAt ?? payment.createdAt).toLocaleString(
                "vi-VN",
              )}{" "}
              · {payment.method === "cash" ? "Tiền mặt" : "Chuyển khoản"}
            </span>
            <strong>
              <Money amount={payment.amount} />
            </strong>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface DebtsPageProps {
  searchParams?: Promise<{ page?: string }>;
}

export default async function DebtsPage({ searchParams }: DebtsPageProps) {
  const params = searchParams ? await searchParams : {};

  const [debtPage, byCustomer, settledRows] = await Promise.all([
    listDebts({ page: parsePageParam(params.page) }),
    summarizeOpenDebts(),
    listSettledDebts(),
  ]);
  const { items: rows, total: openDebtCount, page, pageSize } = debtPage;

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
          {byCustomer.length === 0 ? (
            <EmptyState size="compact" icon={Smile} title="Không ai đang nợ" />
          ) : (
            <ul className="divide-y">
              {byCustomer.map((row) => (
                <li key={row.key} className="flex justify-between gap-4 py-3">
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
            {openDebtCount} đơn còn nợ
          </Badge>
        </CardHeader>
        <CardContent>
          {openDebtCount === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="Hiện không còn đơn nào chưa trả đủ."
              description="Đơn ghi nợ mới sẽ hiện ở đây để tiếp tục thu tiền."
            />
          ) : (
            <>
              {/* Dien thoai: moi don mot the. */}
              <ul data-layout="cards" className="divide-y sm:hidden">
                {rows.map((order) => (
                  <li key={order.id} className="space-y-3 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{order.code}</p>
                      <Badge variant="destructive" className="font-bold">
                        Còn nợ
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {debtCustomerLabel(order)}
                    </p>
                    <DebtAmounts order={order} />
                    <PaymentHistory order={order} />
                    <DebtPaymentForm
                      orderId={order.id}
                      orderCode={order.code}
                      customerName={order.customer?.name ?? "Khách lẻ"}
                      balance={order.balance}
                    />
                  </li>
                ))}
              </ul>

              {/* Tu sm tro len: bang, cung mot mang du lieu. */}
              <div data-layout="table" className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Đơn hàng</TableHead>
                      <TableHead className="text-right">Tổng đơn</TableHead>
                      <TableHead className="text-right">Đã trả</TableHead>
                      <TableHead className="text-right">Còn nợ</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Thu tiền</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((order) => (
                      <TableRow key={order.id} className="align-top">
                        <TableCell className="whitespace-normal">
                          <p className="font-bold">{order.code}</p>
                          <p className="text-muted-foreground text-sm">
                            {debtCustomerLabel(order)}
                          </p>
                          <PaymentHistory order={order} />
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          <Money amount={order.total} />
                        </TableCell>
                        <TableCell className="text-success text-right font-semibold tabular-nums">
                          <Money amount={order.paid} />
                        </TableCell>
                        <TableCell className="text-destructive text-right font-bold tabular-nums">
                          <Money amount={order.balance} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <DebtPaymentForm
                              orderId={order.id}
                              orderCode={order.code}
                              customerName={order.customer?.name ?? "Khách lẻ"}
                              balance={order.balance}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <Pagination
            pathname="/admin/debts"
            label="Phân trang đơn còn nợ"
            page={page}
            pageSize={pageSize}
            total={openDebtCount}
          />
        </CardContent>
      </Card>

      <Card className="border-success/20">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Đã trả xong</CardTitle>
            <p className="text-muted-foreground text-sm">
              {SETTLED_DEBTS_LIMIT} đơn công nợ đã tất toán gần nhất
            </p>
          </div>
          <Badge className="bg-success/12 text-success min-h-7 px-3 text-sm font-bold">
            <CheckCircle aria-hidden="true" weight="fill" />
            {settledRows.length} đơn đã trả đủ
          </Badge>
        </CardHeader>
        <CardContent>
          {settledRows.length === 0 ? (
            <EmptyState
              size="compact"
              icon={History}
              title="Chưa có đơn công nợ nào được trả xong."
            />
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

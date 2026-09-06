import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db/prisma";
import {
  getNextOnlineOrderStatuses,
  isOnlineOrderStatus,
  ONLINE_ORDER_STATUS_LABELS,
} from "@/server/orders/online-order-status";
import {
  markOnlineOrderPaidAction,
  transitionOnlineOrderAction,
} from "../actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Tiền mặt",
  transfer: "Chuyển khoản",
  debt: "Ghi nợ",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      items: true,
      payments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) notFound();
  const onlineStatus =
    order.fulfillmentStatus && isOnlineOrderStatus(order.fulfillmentStatus)
      ? order.fulfillmentStatus
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/orders"
        className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-bold transition-colors"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Quay lại đơn hàng
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Chi tiết đơn hàng</p>
          <h1 className="font-heading mt-1 text-3xl font-bold">{order.code}</h1>
          <p className="text-muted-foreground mt-1">
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "long",
              timeStyle: "short",
            }).format(order.createdAt)}
          </p>
        </div>
        <Badge variant={order.status === "cancelled" ? "outline" : "default"}>
          {order.status === "paid"
            ? "Đã thanh toán"
            : order.status === "debt"
              ? "Ghi nợ"
              : order.status === "cancelled"
                ? "Đã hủy"
                : order.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText aria-hidden="true" /> Các mặt hàng
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-bold">{item.nameSnapshot}</p>
                  <p className="text-muted-foreground text-sm">
                    {item.quantity} {item.unit} × {formatVnd(item.unitPrice)}
                  </p>
                </div>
                <span className="font-bold tabular-nums">
                  {formatVnd(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="border-t pt-4">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tạm tính</dt>
              <dd>{formatVnd(order.subtotal)}</dd>
            </div>
            <div className="mt-2 flex justify-between">
              <dt className="text-muted-foreground">Giảm giá</dt>
              <dd>-{formatVnd(order.discount)}</dd>
            </div>
            <div className="mt-4 flex items-baseline justify-between border-t pt-4">
              <dt className="font-bold">Tổng cộng</dt>
              <dd className="font-heading text-2xl font-bold">
                {formatVnd(order.total)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Thanh toán</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {order.payments.map((payment) => (
                <li key={payment.id} className="flex justify-between">
                  <span>{PAYMENT_LABEL[payment.method] ?? payment.method}</span>
                  <strong>{formatVnd(payment.amount)}</strong>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Khách hàng</CardTitle>
          </CardHeader>
          <CardContent>
            {order.customer ? (
              <div>
                <p className="font-bold">{order.customer.name}</p>
                <p className="text-muted-foreground">
                  {order.customer.phone ?? "Chưa có số điện thoại"}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Khách lẻ</p>
            )}
          </CardContent>
        </Card>
      </div>
      {order.channel === "online" ? (
        <Card>
          <CardHeader>
            <CardTitle>Xử lý đơn online</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-sm">Liên hệ</dt>
                <dd className="font-bold">
                  {order.contactName} · {order.contactPhone}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">Nhận hàng</dt>
                <dd className="font-bold">
                  {order.fulfillmentType === "delivery"
                    ? "Giao tận nơi"
                    : "Nhận tại cửa hàng"}
                </dd>
              </div>
              {order.fulfillmentType === "delivery" ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground text-sm">Địa chỉ</dt>
                  <dd>
                    {[
                      order.deliveryAddress,
                      order.deliveryWard,
                      order.deliveryDistrict,
                      order.deliveryProvince,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground text-sm">Phương thức</dt>
                <dd>
                  {order.paymentMethod === "bank_transfer"
                    ? "Chuyển khoản"
                    : "COD"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-sm">
                  Trạng thái xử lý
                </dt>
                <dd>
                  {onlineStatus
                    ? ONLINE_ORDER_STATUS_LABELS[onlineStatus]
                    : "—"}
                </dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-3">
              {order.status === "pending" ? (
                <form action={markOnlineOrderPaidAction.bind(null, order.id)}>
                  <Button type="submit" variant="outline">
                    Đánh dấu đã thanh toán
                  </Button>
                </form>
              ) : null}
              {onlineStatus
                ? getNextOnlineOrderStatuses(onlineStatus).map((next) => (
                    <form
                      key={next}
                      action={transitionOnlineOrderAction.bind(
                        null,
                        order.id,
                        next,
                      )}
                    >
                      <Button
                        type="submit"
                        variant={
                          next === "cancelled" ? "destructive" : "default"
                        }
                      >
                        {ONLINE_ORDER_STATUS_LABELS[next]}
                      </Button>
                    </form>
                  ))
                : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { notFound } from "next/navigation";

import {
  FulfillmentStatusBadge,
  OrderStatusBadge,
  PageHeader,
} from "@/components/kit";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PrintReceiptButton } from "@/features/orders/print-receipt-button";
import type { ReceiptOrder } from "@/features/orders/receipt-k80";
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
import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  getPublicStoreProfile,
  getStoreBankAccount,
} from "@/server/settings/store-settings";
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
  await requireAdminSession({ redirectToLogin: true });

  const { id } = await params;
  const [order, storeProfile, bankAccount] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        payments: { orderBy: { createdAt: "asc" } },
      },
    }),
    getPublicStoreProfile(),
    getStoreBankAccount(),
  ]);

  if (!order) notFound();

  // Voucher khong giam tien hang (freeship) thi phan giam nam o phi ship.
  const freeshipCode =
    order.voucherCode && order.voucherDiscount === 0 ? order.voucherCode : null;

  // Tien da thu that: bo ghi no va chuyen khoan chua xac nhan nhan tien.
  const received = order.payments
    .filter((payment) => payment.method !== "debt" && payment.receivedAt)
    .reduce((sum, payment) => sum + payment.amount, 0);
  const receiptOrder: ReceiptOrder = {
    code: order.code,
    createdAt: new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(order.createdAt),
    customerName: order.customer?.name ?? order.contactName ?? undefined,
    customerPhone: order.customer?.phone ?? order.contactPhone ?? undefined,
    lines: order.items.map((item) => ({
      name: item.nameSnapshot,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      total: item.lineTotal,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    voucherCode: order.voucherCode ?? undefined,
    // Phi ship luu SAU voucher: subtotal - discount + shippingFee = total.
    shippingFee: order.channel === "online" ? order.shippingFee : undefined,
    total: order.total,
    status: order.status,
    payments: order.payments.map((payment) => ({
      method: payment.method,
      amount: payment.amount,
      receivedAt: payment.receivedAt ? payment.receivedAt.toISOString() : null,
      isCod: order.channel === "online" && order.paymentMethod === "cod",
    })),
    amountDue:
      order.status === "cancelled" ? 0 : Math.max(0, order.total - received),
    note: order.note ?? undefined,
  };
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

      <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
        <PageHeader
          eyebrow="Chi tiết đơn hàng"
          title={order.code}
          description={new Intl.DateTimeFormat("vi-VN", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(order.createdAt)}
          className="min-w-0 flex-1"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <PrintReceiptButton
            storeName={storeProfile.name}
            storeAddress={storeProfile.address}
            storeHotline={storeProfile.hotline}
            order={receiptOrder}
            bankAccount={bankAccount}
          />
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2">
            <ReceiptText aria-hidden="true" /> Các mặt hàng
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <ul className="divide-y">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-3 sm:py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold break-words">{item.nameSnapshot}</p>
                  <p className="text-muted-foreground text-sm">
                    {item.quantity} {item.unit} × {formatVnd(item.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 text-right font-bold tabular-nums">
                  {formatVnd(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="border-t pt-4">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Tạm tính</dt>
              <dd className="shrink-0 font-medium">
                {formatVnd(order.subtotal)}
              </dd>
            </div>
            <div className="mt-2 flex justify-between gap-2">
              <dt className="text-muted-foreground">Giảm giá</dt>
              <dd className="shrink-0 font-medium">
                -{formatVnd(order.discount)}
              </dd>
            </div>
            {order.voucherCode && order.voucherDiscount > 0 ? (
              <div className="mt-2 flex justify-between gap-2 text-sm">
                <dt className="text-muted-foreground">
                  Trong đó mã {order.voucherCode}
                </dt>
                <dd className="shrink-0 font-medium">
                  -{formatVnd(order.voucherDiscount)}
                </dd>
              </div>
            ) : null}
            {order.channel === "online" ? (
              <div className="mt-2 flex justify-between gap-2">
                <dt className="text-muted-foreground">
                  Phí giao hàng
                  {freeshipCode ? (
                    <span data-testid="freeship-code">
                      {" "}
                      (mã {freeshipCode})
                    </span>
                  ) : null}
                </dt>
                <dd className="shrink-0 font-medium">
                  {formatVnd(order.shippingFee)}
                </dd>
              </div>
            ) : null}
            <div className="mt-4 flex items-baseline justify-between gap-2 border-t pt-4">
              <dt className="font-bold">Tổng cộng</dt>
              <dd className="font-heading shrink-0 text-xl font-bold sm:text-2xl">
                {formatVnd(order.total)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Thanh toán</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <ul className="space-y-3">
              {order.payments.map((payment) => {
                const isCodPending =
                  order.channel === "online" &&
                  order.paymentMethod === "cod" &&
                  !payment.receivedAt;
                const label = isCodPending
                  ? "Thu hộ (COD)"
                  : (PAYMENT_LABEL[payment.method] ?? payment.method);
                return (
                  <li
                    key={payment.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="break-words">
                      {label}
                      {!payment.receivedAt ? (
                        <span className="text-muted-foreground ml-1.5 text-xs font-normal">
                          (Chưa thu)
                        </span>
                      ) : null}
                    </span>
                    <strong className="shrink-0 tabular-nums">
                      {formatVnd(payment.amount)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {order.customer ? (
              <div className="space-y-1">
                <p className="font-bold break-words">{order.customer.name}</p>
                <p className="text-muted-foreground text-sm break-all">
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
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>Xử lý đơn online</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-sm">Liên hệ</dt>
                <dd className="font-bold break-words">
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
                  <dd className="font-medium break-words">
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
              {order.deliverySlot ? (
                <div>
                  <dt className="text-muted-foreground text-sm">
                    Khung giờ giao
                  </dt>
                  <dd className="font-medium">{order.deliverySlot}</dd>
                </div>
              ) : null}
              {order.note ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground text-sm">Ghi chú</dt>
                  <dd className="font-medium break-words">{order.note}</dd>
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
                  {onlineStatus ? (
                    <FulfillmentStatusBadge status={onlineStatus} />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
            <div className="flex flex-col flex-wrap gap-2.5 pt-2 sm:flex-row sm:gap-3">
              {order.status === "pending" ? (
                <form
                  className="w-full sm:w-auto"
                  action={markOnlineOrderPaidAction.bind(null, order.id)}
                >
                  <Button
                    type="submit"
                    variant="outline"
                    className="min-h-11 w-full sm:w-auto"
                  >
                    Đánh dấu đã thanh toán
                  </Button>
                </form>
              ) : null}
              {onlineStatus
                ? getNextOnlineOrderStatuses(onlineStatus).map((next) =>
                    next === "cancelled" ? (
                      <ConfirmAction
                        key={next}
                        action={transitionOnlineOrderAction.bind(
                          null,
                          order.id,
                          next,
                        )}
                        triggerLabel="Hủy đơn hàng"
                        title={`Hủy đơn hàng ${order.code}?`}
                        description="Tồn kho và lượt dùng mã giảm giá của đơn hàng sẽ được hoàn lại. Thao tác này không thể hoàn tác."
                        confirmLabel="Xác nhận hủy đơn"
                        triggerClassName="text-destructive font-semibold"
                      />
                    ) : (
                      <form
                        key={next}
                        className="w-full sm:w-auto"
                        action={transitionOnlineOrderAction.bind(
                          null,
                          order.id,
                          next,
                        )}
                      >
                        <Button
                          type="submit"
                          className="min-h-11 w-full sm:w-auto"
                          variant="default"
                        >
                          {ONLINE_ORDER_STATUS_LABELS[next]}
                        </Button>
                      </form>
                    ),
                  )
                : null}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

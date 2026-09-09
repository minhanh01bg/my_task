"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  PackageCheck,
  Printer,
  ShoppingBag,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";

export interface OrderStatusInfo {
  label: string;
  stepIndex: number;
  description: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
}

export function resolveFulfillmentStatus(
  status: string | null | undefined,
  paymentStatus: string,
  fulfillmentType: string | null | undefined,
): OrderStatusInfo {
  if (status === "cancelled" || paymentStatus === "cancelled") {
    return {
      label: "Đã hủy",
      stepIndex: -1,
      description: "Đơn hàng đã bị hủy",
      badgeVariant: "destructive",
    };
  }

  switch (status) {
    case "completed":
      return {
        label: "Hoàn thành",
        stepIndex: 4,
        description: "Đơn hàng đã được giao thành công",
        badgeVariant: "default",
      };
    case "ready":
      return {
        label:
          fulfillmentType === "pickup"
            ? "Sẵn sàng nhận hàng"
            : "Đang giao hàng",
        stepIndex: 3,
        description:
          fulfillmentType === "pickup"
            ? "Đơn hàng đã chuẩn bị xong, bạn có thể ghé cửa hàng để nhận"
            : "Đơn hàng đang trên đường giao tới bạn",
        badgeVariant: "default",
      };
    case "preparing":
      return {
        label: "Đang đóng gói hàng",
        stepIndex: 2,
        description: "Cửa hàng đang đóng gói sản phẩm cho đơn của bạn",
        badgeVariant: "secondary",
      };
    case "confirmed":
      return {
        label: "Đã xác nhận",
        stepIndex: 1,
        description: "Cửa hàng đã xác nhận và xếp lịch chuẩn bị hàng",
        badgeVariant: "secondary",
      };
    case "new":
    default:
      return {
        label: "Đơn mới nhận",
        stepIndex: 0,
        description: "Cửa hàng đã nhận đơn và sẽ sớm liên hệ xác nhận",
        badgeVariant: "outline",
      };
  }
}

const STEPS = [
  { label: "Đặt hàng", icon: ShoppingBag },
  { label: "Xác nhận", icon: Clock },
  { label: "Đóng gói", icon: PackageCheck },
  { label: "Giao hàng", icon: Truck },
  { label: "Hoàn thành", icon: CheckCircle2 },
];

export function CustomerOrderDetail({
  order,
}: {
  order: {
    code: string;
    total: number;
    status: string;
    fulfillmentStatus: string | null;
    fulfillmentType: string | null;
    paymentMethod?: string | null;
    contactName: string | null;
    contactPhone: string | null;
    deliveryAddress: string | null;
    deliveryWard: string | null;
    deliveryDistrict: string | null;
    deliveryProvince: string | null;
    note: string | null;
    items: Array<{
      id: string;
      nameSnapshot: string;
      quantity: number;
      unit: string;
      lineTotal: number;
    }>;
  };
}) {
  const address = [
    order.deliveryAddress,
    order.deliveryWard,
    order.deliveryDistrict,
    order.deliveryProvince,
  ]
    .filter(Boolean)
    .join(", ");

  const statusInfo = resolveFulfillmentStatus(
    order.fulfillmentStatus,
    order.status,
    order.fulfillmentType,
  );

  const isCancelled = statusInfo.stepIndex === -1;

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Header & Print Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="text-primary text-xs font-bold tracking-wider uppercase">
            Thông tin chi tiết đơn hàng
          </span>
          <h1 className="font-heading mt-1 text-3xl font-extrabold sm:text-4xl">
            Đơn {order.code}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            aria-label="In đơn hàng"
            className="font-bold print:hidden"
          >
            <Printer className="mr-2 size-4" />
            <span>In đơn hàng</span>
          </Button>
        </div>
      </div>

      {/* Status Progress Stepper */}
      {isCancelled ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive mt-8 flex items-center gap-3 rounded-2xl border p-5">
          <AlertCircle className="size-6 shrink-0" />
          <div>
            <p className="font-bold">Đơn hàng đã bị hủy</p>
            <p className="mt-1 text-xs sm:text-sm">
              Đơn hàng này đã bị hủy. Quý khách vui lòng liên hệ cửa hàng nếu
              cần hỗ trợ thêm.
            </p>
          </div>
        </div>
      ) : (
        <div className="border-border bg-card/60 mt-8 rounded-2xl border p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-medium">
              Tiến trình xử lý
            </span>
            <Badge
              variant={statusInfo.badgeVariant}
              className="px-3 py-1 font-bold"
            >
              {statusInfo.label}
            </Badge>
          </div>

          <p className="text-muted-foreground mt-2 text-sm">
            {statusInfo.description}
          </p>

          {/* Stepper Bar */}
          <div className="mt-6">
            <ol className="relative grid grid-cols-5 gap-2">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isPassed = statusInfo.stepIndex >= idx;
                const isCurrent = statusInfo.stepIndex === idx;

                const stepLabel =
                  idx === 3 && order.fulfillmentType === "pickup"
                    ? "Sẵn sàng"
                    : step.label;

                return (
                  <li
                    key={step.label}
                    aria-current={isCurrent ? "step" : undefined}
                    className="flex flex-col items-center text-center"
                  >
                    <div
                      className={`flex size-9 items-center justify-center rounded-full transition-colors sm:size-10 ${
                        isCurrent
                          ? "bg-primary text-primary-foreground ring-primary/20 font-bold ring-4"
                          : isPassed
                            ? "bg-primary/20 text-primary font-semibold"
                            : "bg-muted text-muted-foreground/50"
                      }`}
                    >
                      <Icon className="size-4 sm:size-5" />
                    </div>
                    <span
                      className={`mt-2 text-[11px] leading-tight sm:text-xs ${
                        isCurrent
                          ? "text-foreground font-bold"
                          : isPassed
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                      }`}
                    >
                      {stepLabel}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {/* Recipient & Delivery Info */}
      <div className="border-border bg-card mt-6 space-y-4 rounded-2xl border p-6 shadow-xs">
        <h2 className="font-heading text-lg font-bold">Thông tin giao nhận</h2>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <span className="text-muted-foreground block text-xs">
              Người nhận:
            </span>
            <strong className="text-foreground">{order.contactName}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs">
              Điện thoại:
            </span>
            <strong className="text-foreground">{order.contactPhone}</strong>
          </div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground block text-xs">
              Hình thức nhận hàng:
            </span>
            <strong className="text-foreground">
              {order.fulfillmentType === "pickup"
                ? "Nhận tại cửa hàng"
                : address || "Giao tận nơi"}
            </strong>
          </div>
          {order.paymentMethod ? (
            <div>
              <span className="text-muted-foreground block text-xs">
                Phương thức thanh toán:
              </span>
              <span className="text-foreground font-medium">
                {order.paymentMethod === "bank_transfer"
                  ? "Chuyển khoản ngân hàng"
                  : "Thanh toán khi nhận hàng (COD)"}
              </span>
            </div>
          ) : null}
          {order.note ? (
            <div className="sm:col-span-2">
              <span className="text-muted-foreground block text-xs">
                Ghi chú:
              </span>
              <p className="text-foreground mt-0.5 italic">{order.note}</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Order Items Table */}
      <div className="border-border bg-card mt-6 rounded-2xl border p-6 shadow-xs">
        <h2 className="font-heading mb-4 text-lg font-bold">Mặt hàng đã đặt</h2>
        <ul className="divide-border divide-y">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
            >
              <div>
                <span className="text-foreground font-semibold">
                  {item.nameSnapshot} × {item.quantity} {item.unit}
                </span>
              </div>
              <strong className="text-foreground font-mono">
                {formatVnd(item.lineTotal)} ₫
              </strong>
            </li>
          ))}
        </ul>

        <div className="border-border mt-5 flex items-baseline justify-between border-t pt-4">
          <span className="text-lg font-bold">Tổng thanh toán</span>
          <span className="text-primary font-heading text-2xl font-extrabold">
            {formatVnd(order.total)} ₫
          </span>
        </div>
      </div>
    </main>
  );
}

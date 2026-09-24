import { Check, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  isOnlineOrderStatus,
  ONLINE_ORDER_STATUSES,
  type OnlineOrderStatus,
} from "@/server/orders/online-order-status";

type ProgressStatus = Exclude<OnlineOrderStatus, "cancelled">;
type StepState = "done" | "current" | "upcoming" | "cancelled";

interface TimelineStep {
  key: string;
  label: string;
  state: StepState;
  time?: Date;
}

export interface OrderTimelineOrder {
  fulfillmentStatus: string | null;
  fulfillmentType: string | null;
  /** Trang thai thanh toan — "cancelled" cung nghia la don da huy. */
  status: string;
  createdAt: Date;
}

const PROGRESS_STEPS = ONLINE_ORDER_STATUSES.filter(
  (status): status is ProgressStatus => status !== "cancelled",
);

const STATE_SR_TEXT: Record<StepState, string> = {
  done: "Đã qua",
  current: "Hiện tại",
  upcoming: "Sắp tới",
  cancelled: "Hiện tại",
};

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});

function stepLabel(
  status: ProgressStatus,
  fulfillmentType: string | null,
): string {
  switch (status) {
    case "new":
      return "Đã đặt hàng";
    case "confirmed":
      return "Đã xác nhận";
    case "preparing":
      return "Đang chuẩn bị";
    case "ready":
      return fulfillmentType === "pickup"
        ? "Sẵn sàng nhận hàng"
        : "Đang giao hàng";
    case "completed":
      return "Hoàn tất";
  }
}

function buildSteps(
  current: OnlineOrderStatus,
  order: OrderTimelineOrder,
): TimelineStep[] {
  // Order chi luu createdAt — cac buoc sau khong co moc thoi gian rieng.
  const placed: TimelineStep = {
    key: "new",
    label: stepLabel("new", order.fulfillmentType),
    state: "done",
    time: order.createdAt,
  };

  if (current === "cancelled") {
    return [placed, { key: "cancelled", label: "Đã hủy", state: "cancelled" }];
  }

  const currentIndex = PROGRESS_STEPS.indexOf(current);
  return PROGRESS_STEPS.map((status, index) => ({
    key: status,
    label: stepLabel(status, order.fulfillmentType),
    state:
      index < currentIndex
        ? "done"
        : index === currentIndex
          ? "current"
          : "upcoming",
    time: status === "new" ? order.createdAt : undefined,
  }));
}

/** Dong thoi gian trang thai don online; khong render gi voi don POS. */
export function OrderTimeline({
  order,
  className,
}: {
  order: OrderTimelineOrder;
  className?: string;
}) {
  const { fulfillmentStatus } = order;
  if (!fulfillmentStatus || !isOnlineOrderStatus(fulfillmentStatus)) {
    return null;
  }

  const current: OnlineOrderStatus =
    order.status === "cancelled" ? "cancelled" : fulfillmentStatus;
  const steps = buildSteps(current, order);

  return (
    <section aria-label="Trạng thái đơn hàng" className={className}>
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const isActive =
            step.state === "current" || step.state === "cancelled";
          return (
            <li
              key={step.key}
              aria-current={isActive ? "step" : undefined}
              className="relative flex gap-3 pb-5 last:pb-0"
            >
              {isLast ? null : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-8 bottom-0 left-[0.9375rem] w-0.5 -translate-x-1/2",
                    step.state === "done" ? "bg-primary/40" : "bg-border",
                  )}
                />
              )}
              <span
                aria-hidden="true"
                data-step-marker=""
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-full",
                  step.state === "done" && "bg-primary/15 text-primary",
                  step.state === "current" &&
                    "bg-primary text-primary-foreground ring-primary/20 ring-4",
                  step.state === "upcoming" && "bg-muted text-muted-foreground",
                  step.state === "cancelled" &&
                    "bg-destructive/10 text-destructive ring-destructive/20 ring-4",
                )}
              >
                {step.state === "cancelled" ? (
                  <X className="size-4" />
                ) : step.state === "done" ? (
                  <Check className="size-4" />
                ) : (
                  <span className="size-2 rounded-full bg-current" />
                )}
              </span>
              <div className="min-w-0 pt-1">
                <p
                  data-step-label=""
                  className={cn(
                    "text-sm leading-6",
                    step.state === "done" && "text-foreground font-medium",
                    step.state === "current" && "text-foreground font-bold",
                    step.state === "upcoming" && "text-muted-foreground",
                    step.state === "cancelled" && "text-destructive font-bold",
                  )}
                >
                  {step.label}
                </p>
                <span className="sr-only">{STATE_SR_TEXT[step.state]}</span>
                {step.time ? (
                  <time
                    dateTime={step.time.toISOString()}
                    className="text-muted-foreground block text-xs tabular-nums"
                  >
                    {timeFormatter.format(step.time)}
                  </time>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

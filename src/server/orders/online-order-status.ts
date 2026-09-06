export const ONLINE_ORDER_STATUSES = [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type OnlineOrderStatus = (typeof ONLINE_ORDER_STATUSES)[number];

export const ONLINE_ORDER_STATUS_LABELS: Record<OnlineOrderStatus, string> = {
  new: "Đơn mới",
  confirmed: "Đã xác nhận",
  preparing: "Đang chuẩn bị",
  ready: "Sẵn sàng giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
};

const TRANSITIONS: Record<OnlineOrderStatus, readonly OnlineOrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function isOnlineOrderStatus(value: string): value is OnlineOrderStatus {
  return ONLINE_ORDER_STATUSES.includes(value as OnlineOrderStatus);
}

export function canTransitionOnlineOrder(
  from: OnlineOrderStatus,
  to: OnlineOrderStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function getNextOnlineOrderStatuses(
  from: OnlineOrderStatus,
): readonly OnlineOrderStatus[] {
  return TRANSITIONS[from];
}

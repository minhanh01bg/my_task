import { describe, expect, it } from "vitest";

import {
  canTransitionOnlineOrder,
  getNextOnlineOrderStatuses,
  isOnlineOrderStatus,
} from "@/server/orders/online-order-status";

describe("online order fulfillment lifecycle", () => {
  it("chỉ cho phép các bước kế tiếp hợp lệ", () => {
    expect(canTransitionOnlineOrder("new", "confirmed")).toBe(true);
    expect(canTransitionOnlineOrder("new", "preparing")).toBe(false);
    expect(canTransitionOnlineOrder("confirmed", "preparing")).toBe(true);
    expect(canTransitionOnlineOrder("preparing", "ready")).toBe(true);
    expect(canTransitionOnlineOrder("ready", "completed")).toBe(true);
  });

  it("cho phép hủy trước khi hoàn tất", () => {
    for (const status of ["new", "confirmed", "preparing", "ready"] as const) {
      expect(canTransitionOnlineOrder(status, "cancelled")).toBe(true);
    }
  });

  it("khóa các trạng thái kết thúc", () => {
    expect(getNextOnlineOrderStatuses("completed")).toEqual([]);
    expect(getNextOnlineOrderStatuses("cancelled")).toEqual([]);
  });

  it("nhận diện trạng thái online", () => {
    expect(isOnlineOrderStatus("new")).toBe(true);
    expect(isOnlineOrderStatus("paid")).toBe(false);
  });
});

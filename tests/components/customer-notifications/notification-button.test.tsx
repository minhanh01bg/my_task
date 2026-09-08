import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CustomerNotificationButton } from "@/features/customer-notifications/notification-button";

const mockNotificationsResponse = {
  items: [
    {
      id: "cust-notif-1",
      accountId: "acc-1",
      eventKey: "customer-order:order-1:created",
      kind: "order_created",
      title: "Đặt hàng thành công",
      body: "Đơn hàng #DH-1001 đã được tiếp nhận.",
      orderId: "order-1",
      href: "/account/orders/order-1",
      createdAt: "2026-09-08T08:00:00.000Z",
      readAt: null,
    },
    {
      id: "cust-notif-2",
      accountId: "acc-1",
      eventKey: "customer-order:order-2:status:completed",
      kind: "order_status_completed",
      title: "Đơn hàng hoàn tất",
      body: "Đơn hàng #DH-1000 đã hoàn tất thành công.",
      orderId: "order-2",
      href: "/account/orders/order-2",
      createdAt: "2026-09-08T07:00:00.000Z",
      readAt: "2026-09-08T07:30:00.000Z",
    },
  ],
  unreadCount: 1,
  nextCursor: null,
};

describe("CustomerNotificationButton", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/customer/notifications/read")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ ok: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockNotificationsResponse,
        });
      }),
    );
  });

  it("hiển thị badge số lượng chưa đọc và mở panel thông báo", async () => {
    render(<CustomerNotificationButton />);

    // Kiểm tra badge hiển thị đúng 1
    const badge = await screen.findByTestId("customer-notification-badge");
    expect(badge).toHaveTextContent("1");

    // Click nút mở panel
    const button = screen.getByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    // Kiểm tra danh sách thông báo và đường dẫn deep link
    expect(await screen.findByText("Đặt hàng thành công")).toBeInTheDocument();
    expect(screen.getByText("Đơn hàng hoàn tất")).toBeInTheDocument();

    const orderLink = screen.getByRole("link", {
      name: /đặt hàng thành công/i,
    });
    expect(orderLink).toHaveAttribute("href", "/account/orders/order-1");
  });

  it("hiển thị '99+' khi unreadCount vượt quá 99", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockNotificationsResponse,
          unreadCount: 150,
        }),
      }),
    );

    render(<CustomerNotificationButton />);

    const badge = await screen.findByTestId("customer-notification-badge");
    expect(badge).toHaveTextContent("99+");
  });

  it("gọi API mark-read khi bấm đánh dấu một tin đã đọc", async () => {
    render(<CustomerNotificationButton />);

    const button = await screen.findByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    const markOneBtn = await screen.findByRole("button", {
      name: /đánh dấu đã đọc/i,
    });
    fireEvent.click(markOneBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/customer/notifications/read",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ notificationId: "cust-notif-1" }),
        }),
      );
    });
  });

  it("gọi API mark-read khi bấm đọc tất cả", async () => {
    render(<CustomerNotificationButton />);

    const button = await screen.findByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    const markAllBtn = await screen.findByRole("button", {
      name: /đọc tất cả/i,
    });
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/customer/notifications/read",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ all: true }),
        }),
      );
    });
  });

  it("hiển thị trạng thái trống khi không có thông báo nào", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [],
          unreadCount: 0,
          nextCursor: null,
        }),
      }),
    );

    render(<CustomerNotificationButton />);

    const button = await screen.findByRole("button", { name: /thông báo/i });
    fireEvent.click(button);

    expect(await screen.findByText("Chưa có thông báo")).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationButton } from "@/features/admin-notifications/notification-button";
import { NotificationProvider } from "@/features/admin-notifications/notification-provider";

const response = {
  data: {
    items: [
      {
        id: "notification-1",
        kind: "online_order_created",
        title: "Có đơn online mới",
        body: "Đơn DH1001 · 50.000 ₫",
        entityType: "order",
        entityId: "order-1",
        href: "/admin/orders/order-1",
        createdAt: "2026-09-06T10:00:00.000Z",
        readAt: null,
      },
    ],
    nextCursor: null,
    unreadCount: 1,
    cutoff: "2026-09-06T10:00:01.000Z",
  },
};

describe("NotificationButton", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => response }),
    );
  });

  it("hiện badge, panel và link order chính xác", async () => {
    render(
      <NotificationProvider>
        <NotificationButton />
      </NotificationProvider>,
    );
    expect(await screen.findByTestId("notification-badge")).toHaveTextContent(
      "1",
    );
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    expect(
      screen.getByRole("link", { name: /Có đơn online mới/ }),
    ).toHaveAttribute("href", "/admin/orders/order-1");
    fireEvent.click(screen.getByRole("button", { name: /Đánh dấu đã đọc/ }));
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/notifications/read",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});

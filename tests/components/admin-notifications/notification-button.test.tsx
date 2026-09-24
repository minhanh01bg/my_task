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

  it("panel thông báo có z-index cao nhất (z-[100]) khi mở ra", async () => {
    render(
      <NotificationProvider>
        <NotificationButton />
      </NotificationProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    const panel = screen.getByRole("region", { name: "Thông báo quản trị" });
    expect(panel).toHaveClass("z-[100]");
  });

  it("Escape đóng panel và trả focus về nút chuông", async () => {
    render(
      <NotificationProvider>
        <NotificationButton />
      </NotificationProvider>,
    );
    const trigger = screen.getByRole("button", { name: /Thông báo/ });
    fireEvent.click(trigger);
    expect(
      screen.getByRole("region", { name: "Thông báo quản trị" }),
    ).toHaveClass("animate-popover-enter");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("region", { name: "Thông báo quản trị" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("bấm ra ngoài panel thì đóng, bấm trong panel thì không", async () => {
    render(
      <>
        <NotificationProvider>
          <NotificationButton />
        </NotificationProvider>
        <main>Nội dung trang</main>
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));
    const panel = screen.getByRole("region", { name: "Thông báo quản trị" });

    fireEvent.pointerDown(panel);
    expect(
      screen.getByRole("region", { name: "Thông báo quản trị" }),
    ).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByText("Nội dung trang"));
    expect(
      screen.queryByRole("region", { name: "Thông báo quản trị" }),
    ).not.toBeInTheDocument();
  });

  it("không có thông báo thì hiện EmptyState chung của kit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { ...response.data, items: [], unreadCount: 0 },
        }),
      }),
    );
    render(
      <NotificationProvider>
        <NotificationButton />
      </NotificationProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Thông báo/ }));

    const title = await screen.findByText("Chưa có thông báo");
    expect(title.closest('[data-slot="empty-state"]')).not.toBeNull();
  });
});

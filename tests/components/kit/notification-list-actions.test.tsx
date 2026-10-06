import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { NotificationList } from "@/components/kit/notification-list";

it.each([
  ["online_order_created", "Xem đơn hàng", "/admin/orders/order-1"],
  ["order_status_shipping", "Theo dõi đơn hàng", "/account/orders/order-1"],
  ["order_payment_paid", "Xem thanh toán", "/account/orders/order-1"],
  ["order_claimed", "Xem đơn hàng", "/account/orders/order-1"],
  ["low_stock", "Kiểm tra tồn kho", "/admin/products?edit=product-1"],
  ["unknown", "Xem chi tiết", "/admin/products"],
])(
  "%s hiển thị thao tác đúng và đánh dấu đã đọc khi mở",
  (kind, action, href) => {
    const onMarkRead = vi.fn();
    const onNavigate = vi.fn();
    render(
      <NotificationList
        items={[
          {
            id: "n-1",
            title: "Thông báo thử",
            body: "Nội dung",
            kind,
            href,
            createdAt: "2026-10-06T00:00:00Z",
            readAt: null,
          },
        ]}
        loading={false}
        error={null}
        onRetry={() => {}}
        onMarkRead={onMarkRead}
        onNavigate={onNavigate}
        emptyDescription="Chưa có thông báo"
      />,
    );
    const link = screen.getByRole("link", { name: new RegExp(action) });
    expect(link).toHaveAttribute("href", href);
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(onMarkRead).toHaveBeenCalledWith("n-1");
  },
);

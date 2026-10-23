import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { NotificationList } from "@/components/kit/notification-list";

it.each([
  ["online_order_created", "Xem đơn hàng", "/admin/orders/order-1"],
  ["order_status_shipping", "Theo dõi đơn hàng", "/account/orders/order-1"],
  ["order_payment_paid", "Xem thanh toán", "/account/orders/order-1"],
  ["order_claimed", "Xem đơn hàng", "/account/orders/order-1"],
  ["low_stock", "Kiểm tra tồn kho", "/admin/products?edit=product-1"],
  ["back_in_stock", "Xem sản phẩm", "/shop/p/sua-chua-uong"],
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

it("back_in_stock không dùng nhãn và biểu tượng tồn kho của admin", () => {
  const { container } = render(
    <NotificationList
      items={[
        {
          id: "n-2",
          title: "Sản phẩm bạn chờ đã có hàng",
          body: "Sữa chua uống đã có hàng trở lại. Đặt mua ngay trước khi hết nhé.",
          kind: "back_in_stock",
          href: "/shop/products/prod_01",
          createdAt: "2026-10-23T00:00:00Z",
          readAt: null,
        },
      ]}
      loading={false}
      error={null}
      onRetry={() => {}}
      onMarkRead={() => {}}
      emptyDescription="Chưa có thông báo"
    />,
  );
  expect(screen.getByText("Xem sản phẩm")).toBeInTheDocument();
  expect(screen.queryByText("Kiểm tra tồn kho")).not.toBeInTheDocument();
  expect(container.querySelector(".tabler-icon-bell-ringing")).not.toBeNull();
  expect(container.querySelector(".tabler-icon-alert-triangle")).toBeNull();
});

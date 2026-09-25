import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ChannelBadge,
  FulfillmentStatusBadge,
  OrderStatusBadge,
} from "@/components/kit/order-status-badge";

describe("OrderStatusBadge and status badge templates", () => {
  it("renders correct payment status labels and variants", () => {
    const { rerender } = render(<OrderStatusBadge status="paid" />);
    expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();

    rerender(<OrderStatusBadge status="pending" />);
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();

    rerender(<OrderStatusBadge status="debt" />);
    expect(screen.getByText("Ghi nợ")).toBeInTheDocument();

    rerender(<OrderStatusBadge status="cancelled" />);
    expect(screen.getByText("Đã hủy")).toBeInTheDocument();
  });

  it("renders correct fulfillment status labels", () => {
    const { rerender } = render(<FulfillmentStatusBadge status="new" />);
    expect(screen.getByText("Đơn mới")).toBeInTheDocument();

    rerender(<FulfillmentStatusBadge status="preparing" />);
    expect(screen.getByText("Đang chuẩn bị")).toBeInTheDocument();

    rerender(<FulfillmentStatusBadge status="ready" />);
    expect(screen.getByText("Sẵn sàng giao")).toBeInTheDocument();

    rerender(<FulfillmentStatusBadge status="completed" />);
    expect(screen.getByText("Hoàn tất")).toBeInTheDocument();
  });

  it("returns null when fulfillment status is not provided", () => {
    const { container } = render(<FulfillmentStatusBadge status={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders correct sales channel badge", () => {
    const { rerender } = render(<ChannelBadge channel="pos" />);
    expect(screen.getByText("Tại quầy")).toBeInTheDocument();

    rerender(<ChannelBadge channel="online" />);
    expect(screen.getByText("Trực tuyến")).toBeInTheDocument();
  });
});

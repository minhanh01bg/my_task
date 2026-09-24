import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrderTimeline } from "@/features/customer-account/order-timeline";

const createdAt = new Date("2026-09-20T03:15:00.000Z");

function stepLabels() {
  return within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((item) => item.querySelector("[data-step-label]")?.textContent);
}

describe("OrderTimeline", () => {
  it("hiển thị đủ các bước theo thứ tự và đánh dấu bước hiện tại", () => {
    render(
      <OrderTimeline
        order={{
          fulfillmentStatus: "preparing",
          fulfillmentType: "delivery",
          status: "pending",
          createdAt,
        }}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Trạng thái đơn hàng" }),
    ).toBeInTheDocument();
    expect(stepLabels()).toEqual([
      "Đã đặt hàng",
      "Đã xác nhận",
      "Đang chuẩn bị",
      "Đang giao hàng",
      "Hoàn tất",
    ]);

    const current = screen
      .getAllByRole("listitem")
      .filter((item) => item.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Đang chuẩn bị");
    expect(current[0].querySelector("[data-step-marker]")).toHaveClass(
      "bg-primary",
    );

    const future = screen.getByText("Hoàn tất").closest("li");
    expect(future).not.toHaveAttribute("aria-current");
    expect(future?.querySelector("[data-step-label]")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("chỉ hiển thị thời gian ở bước đặt hàng vì đơn chỉ lưu createdAt", () => {
    render(
      <OrderTimeline
        order={{
          fulfillmentStatus: "confirmed",
          fulfillmentType: "delivery",
          status: "pending",
          createdAt,
        }}
      />,
    );

    const times = document.querySelectorAll("time");
    expect(times).toHaveLength(1);
    expect(times[0]).toHaveAttribute("dateTime", createdAt.toISOString());
    expect(screen.getByText("Đã đặt hàng").closest("li")).toContainElement(
      times[0] as HTMLElement,
    );
  });

  it("đổi nhãn bước sẵn sàng cho đơn nhận tại cửa hàng", () => {
    render(
      <OrderTimeline
        order={{
          fulfillmentStatus: "ready",
          fulfillmentType: "pickup",
          status: "paid",
          createdAt,
        }}
      />,
    );

    expect(
      screen.getByText("Sẵn sàng nhận hàng").closest("li"),
    ).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText("Đang giao hàng")).not.toBeInTheDocument();
  });

  it("hiển thị trạng thái đã hủy bằng màu destructive và bỏ các bước chưa tới", () => {
    render(
      <OrderTimeline
        order={{
          fulfillmentStatus: "cancelled",
          fulfillmentType: "delivery",
          status: "cancelled",
          createdAt,
        }}
      />,
    );

    expect(stepLabels()).toEqual(["Đã đặt hàng", "Đã hủy"]);
    const cancelled = screen.getByText("Đã hủy").closest("li");
    expect(cancelled).toHaveAttribute("aria-current", "step");
    expect(cancelled?.querySelector("[data-step-label]")).toHaveClass(
      "text-destructive",
    );
    expect(document.querySelector(".bg-primary")).toBeNull();
  });

  it("coi đơn bị hủy thanh toán là đã hủy dù trạng thái xử lý chưa cập nhật", () => {
    render(
      <OrderTimeline
        order={{
          fulfillmentStatus: "new",
          fulfillmentType: "delivery",
          status: "cancelled",
          createdAt,
        }}
      />,
    );

    expect(screen.getByText("Đã hủy").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("không hiển thị gì với đơn POS (không có fulfillmentStatus)", () => {
    const { container } = render(
      <OrderTimeline
        order={{
          fulfillmentStatus: null,
          fulfillmentType: null,
          status: "paid",
          createdAt,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("không hiển thị gì khi fulfillmentStatus không hợp lệ", () => {
    const { container } = render(
      <OrderTimeline
        order={{
          fulfillmentStatus: "shipped-by-owl",
          fulfillmentType: "delivery",
          status: "pending",
          createdAt,
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

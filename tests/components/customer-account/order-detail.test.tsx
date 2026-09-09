import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomerOrderDetail } from "@/features/customer-account/order-detail";

const mockOrder = {
  id: "ord-test-001",
  code: "DH-ONLINE-001",
  total: 180_000,
  status: "pending",
  fulfillmentStatus: "preparing",
  fulfillmentType: "delivery",
  paymentMethod: "cod",
  contactName: "Nguyễn Văn An",
  contactPhone: "0901234567",
  deliveryAddress: "123 Đường Lê Lợi",
  deliveryWard: "Phường Bến Nghé",
  deliveryDistrict: "Quận 1",
  deliveryProvince: "TP. Hồ Chí Minh",
  note: "Giao trong giờ hành chính",
  items: [
    {
      id: "item-1",
      nameSnapshot: "Gạo ST25 Thượng Hạng",
      quantity: 2,
      unit: "túi 5kg",
      lineTotal: 180_000,
    },
  ],
};

describe("CustomerOrderDetail", () => {
  it("hiển thị nhãn trạng thái tiếng Việt thân thiện và thanh tiến trình đơn hàng", () => {
    render(<CustomerOrderDetail order={mockOrder} />);

    expect(screen.getByText("Đơn DH-ONLINE-001")).toBeInTheDocument();
    expect(screen.getByText("Đang đóng gói hàng")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn An")).toBeInTheDocument();
    expect(screen.getByText("0901234567")).toBeInTheDocument();
    expect(
      screen.getByText(
        "123 Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Gạo ST25 Thượng Hạng × 2 túi 5kg"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("180.000 ₫").length).toBe(2);

    // Stepper checks
    expect(screen.getByText("Đặt hàng")).toBeInTheDocument();
    expect(screen.getByText("Xác nhận")).toBeInTheDocument();
    expect(screen.getByText("Đóng gói")).toBeInTheDocument();
  });

  it("hiển thị cảnh báo đơn đã hủy rõ ràng", () => {
    const cancelledOrder = {
      ...mockOrder,
      status: "cancelled",
      fulfillmentStatus: "cancelled",
    };
    render(<CustomerOrderDetail order={cancelledOrder} />);

    expect(screen.getByText("Đơn hàng đã bị hủy")).toBeInTheDocument();
  });

  it("có nút in đơn hàng và gọi window.print khi bấm", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup();

    render(<CustomerOrderDetail order={mockOrder} />);

    const printBtn = screen.getByRole("button", {
      name: /in đơn hàng|in biên nhận/i,
    });
    expect(printBtn).toBeInTheDocument();
    await user.click(printBtn);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});

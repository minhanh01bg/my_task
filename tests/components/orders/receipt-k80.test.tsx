import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReceiptK80 } from "@/features/orders/receipt-k80";

describe("ReceiptK80 component", () => {
  const sampleOrder = {
    code: "DH-8899",
    createdAt: "2026-09-11 10:30",
    cashier: "Thu ngân Mai",
    customerName: "Anh Tuấn",
    customerPhone: "0909123456",
    lines: [
      {
        name: "Nước mắm Nam Ngư 750ml",
        quantity: 2,
        unit: "chai",
        unitPrice: 42_000,
        total: 84_000,
      },
      {
        name: "Dầu ăn Simply 1L",
        quantity: 1,
        unit: "chai",
        unitPrice: 58_000,
        total: 58_000,
      },
    ],
    subtotal: 142_000,
    discount: 20_000,
    total: 122_000,
    payments: [{ method: "cash", amount: 150_000, change: 28_000 }],
    note: "Giao trước 11h30",
  };

  it("hiển thị đầy đủ thông tin hóa đơn thanh toán K80", () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        storeAddress="123 Nguyễn Huệ, Q.1"
        storeHotline="0901234567"
        order={sampleOrder}
      />,
    );

    expect(screen.getByText("TẠP HÓA VIỆT")).toBeInTheDocument();
    expect(screen.getByText(/DH-8899/i)).toBeInTheDocument();
    expect(screen.getByText("Nước mắm Nam Ngư 750ml")).toBeInTheDocument();
    expect(screen.getByText("Dầu ăn Simply 1L")).toBeInTheDocument();
    expect(screen.getByText(/122.000/i)).toBeInTheDocument();
    expect(
      screen.getByText("CẢM ƠN QUÝ KHÁCH - HẸN GẶP LẠI"),
    ).toBeInTheDocument();
  });

  it("gọi hàm window.print khi bấm nút In hóa đơn", () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<ReceiptK80 storeName="Tạp Hóa Việt" order={sampleOrder} />);

    const printButton = screen.getByRole("button", { name: /in hóa đơn/i });
    fireEvent.click(printButton);

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});

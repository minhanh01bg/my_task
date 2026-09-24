import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrintReceiptButton } from "@/features/orders/print-receipt-button";
import {
  ReceiptK80,
  resolveReceiptQrAmount,
} from "@/features/orders/receipt-k80";

const bankAccount = {
  bankBin: "970423",
  accountNumber: "0123456789",
  accountName: "NGUYEN VAN A",
};

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

  it("không in VietQR khi đơn tiền mặt đã trả đủ", () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={sampleOrder}
        bankAccount={bankAccount}
      />,
    );
    expect(screen.queryByTestId("receipt-vietqr")).not.toBeInTheDocument();
  });

  it("không in VietQR khi chưa cấu hình tài khoản dù còn nợ", () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={{ ...sampleOrder, amountDue: 50_000 }}
        bankAccount={null}
      />,
    );
    expect(screen.queryByTestId("receipt-vietqr")).not.toBeInTheDocument();
  });

  it("in VietQR với số tiền còn thiếu khi đơn chưa thanh toán đủ", async () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={{ ...sampleOrder, payments: [], amountDue: 122_000 }}
        bankAccount={bankAccount}
      />,
    );
    const qr = screen.getByTestId("receipt-vietqr");
    expect(qr).toHaveTextContent("NGUYEN VAN A — 0123456789");
    expect(qr).toHaveTextContent("ND: DH-8899");
    const img = await screen.findByRole("img", { name: /VietQR/ });
    expect(img.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("in VietQR tổng đơn khi khách trả bằng chuyển khoản", () => {
    const order = {
      ...sampleOrder,
      payments: [{ method: "transfer", amount: 122_000 }],
    };
    expect(resolveReceiptQrAmount(order)).toBe(122_000);
    expect(resolveReceiptQrAmount(sampleOrder)).toBeNull();
    expect(resolveReceiptQrAmount({ ...sampleOrder, amountDue: 20_000 })).toBe(
      20_000,
    );

    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={order}
        bankAccount={bankAccount}
      />,
    );
    expect(screen.getByTestId("receipt-vietqr")).toBeInTheDocument();
  });

  it("PrintReceiptButton mở xem trước hóa đơn K80", async () => {
    render(<PrintReceiptButton storeName="Tạp Hóa Việt" order={sampleOrder} />);

    expect(screen.queryByText("TẠP HÓA VIỆT")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "In hoá đơn" }));

    expect(await screen.findByText("TẠP HÓA VIỆT")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /in hóa đơn \(k80\)/i }),
    ).toBeInTheDocument();
  });
});

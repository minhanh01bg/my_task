import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it("gọi hàm window.print khi bấm nút In hóa đơn", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<ReceiptK80 storeName="Tạp Hóa Việt" order={sampleOrder} />);

    const printButton = screen.getByRole("button", { name: /in hóa đơn/i });
    fireEvent.click(printButton);

    await vi.waitFor(() => expect(printSpy).toHaveBeenCalled());
    printSpy.mockRestore();
  });

  it("đơn ghi nợ in nhãn tiếng Việt và số tiền còn phải thu", () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={{
          ...sampleOrder,
          payments: [{ method: "debt", amount: 122_000 }],
          amountDue: 122_000,
        }}
      />,
    );

    expect(screen.queryByText(/debt/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tiền khách đưa/i)).not.toBeInTheDocument();
    expect(screen.getByText("Ghi nợ:")).toBeInTheDocument();
    expect(screen.getByText("CÒN PHẢI THU:").parentElement).toHaveTextContent(
      "122.000",
    );
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

  it("in từ một bản sao nằm ngay dưới body (portal), gọi print sau khi portal mount", async () => {
    let printedCopy: Element | null = null;
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {
      printedCopy = document.body.querySelector(
        ":scope > [data-print-receipt]",
      );
    });
    render(<PrintReceiptButton storeName="Tạp Hóa Việt" order={sampleOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "In hoá đơn" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /in hóa đơn \(k80\)/i }),
    );

    await vi.waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1));
    expect(printedCopy).not.toBeNull();
    const copy = printedCopy as unknown as HTMLElement;
    expect(copy.parentElement).toBe(document.body);
    expect(within(copy).getByText("TẠP HÓA VIỆT")).toBeInTheDocument();
    // Ban xem truoc trong hop thoai khong mang dau in.
    expect(
      screen.getByRole("dialog").querySelector("[data-print-receipt]"),
    ).toBeNull();

    // In xong thi go ban sao.
    fireEvent(window, new Event("afterprint"));
    await vi.waitFor(() =>
      expect(document.body.querySelector("[data-print-receipt]")).toBeNull(),
    );
    printSpy.mockRestore();
  });

  it("đơn online in dòng phí giao hàng và mã ưu đãi, cộng khớp tổng", () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={{
          ...sampleOrder,
          shippingFee: 15_000,
          voucherCode: "GIAM20K",
          total: 137_000,
        }}
      />,
    );
    const shippingRow = screen.getByText("Phí giao hàng:").parentElement;
    expect(shippingRow).toHaveTextContent("15.000");
    expect(screen.getByText(/GIAM20K/)).toBeInTheDocument();
    expect(screen.getByText("THANH TOÁN:").parentElement).toHaveTextContent(
      "137.000",
    );
  });

  it("không in dòng phí giao hàng khi phí bằng 0", () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={{ ...sampleOrder, shippingFee: 0 }}
      />,
    );
    expect(screen.queryByText("Phí giao hàng:")).not.toBeInTheDocument();
  });

  it("đơn đã huỷ không bao giờ in VietQR", () => {
    render(
      <ReceiptK80
        storeName="Tạp Hóa Việt"
        order={{
          ...sampleOrder,
          status: "cancelled",
          amountDue: 122_000,
          payments: [{ method: "transfer", amount: 122_000 }],
        }}
        bankAccount={bankAccount}
      />,
    );
    expect(screen.queryByTestId("receipt-vietqr")).not.toBeInTheDocument();
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

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BankTransferPayment } from "@/features/online-store/bank-transfer-payment";

const order = {
  code: "DH123456",
  total: 120000,
  status: "pending",
  fulfillmentStatus: "new",
  paymentMethod: "bank_transfer",
};

describe("hướng dẫn chuyển khoản online", () => {
  it("thiếu tài khoản thì hướng dẫn liên hệ, không yêu cầu khách vào admin", () => {
    render(<BankTransferPayment order={order} bankAccount={null} />);
    expect(
      screen.getByRole("heading", { name: "Thanh toán chuyển khoản" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cửa hàng chưa cung cấp tài khoản nhận tiền/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/quản lý/i)).not.toBeInTheDocument();
  });
  it.each([
    { ...order, status: "paid" },
    { ...order, status: "cancelled" },
    { ...order, fulfillmentStatus: "cancelled" },
    { ...order, paymentMethod: "cod" },
  ])("không yêu cầu trả tiền cho đơn đã trả, đã hủy hoặc COD: %j", (input) => {
    const { container } = render(
      <BankTransferPayment order={input} bankAccount={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

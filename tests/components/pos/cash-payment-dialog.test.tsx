import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CashPaymentDialog } from "@/components/pos/cash-payment-dialog";

describe("CashPaymentDialog", () => {
  it("hien tong tien phai tra", () => {
    render(
      <CashPaymentDialog
        open
        total={37500}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByTestId("payment-total")).toHaveTextContent("37.500");
  });

  it("tinh tien thoi lai", async () => {
    const user = userEvent.setup();
    render(
      <CashPaymentDialog
        open
        total={37500}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "50000");

    expect(screen.getByTestId("payment-change")).toHaveTextContent("12.500");
  });

  it("khach dua thieu thi khong hien tien thoi am", async () => {
    const user = userEvent.setup();
    render(
      <CashPaymentDialog
        open
        total={37500}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "20000");

    expect(screen.getByTestId("payment-change")).toHaveTextContent("0");
  });

  it("nut menh gia nhanh dien so tien", async () => {
    const user = userEvent.setup();
    render(
      <CashPaymentDialog
        open
        total={37500}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "100.000" }));

    expect(screen.getByTestId("payment-change")).toHaveTextContent("62.500");
  });

  it("nut dung so tien dien dung tong", async () => {
    const user = userEvent.setup();
    render(
      <CashPaymentDialog
        open
        total={37500}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /đúng số tiền/i }));

    expect(screen.getByTestId("payment-change")).toHaveTextContent("0");
  });

  it("xac nhan tra ve so tien khach dua", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <CashPaymentDialog
        open
        total={37500}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "50000");
    await user.click(screen.getByRole("button", { name: /^xác nhận/i }));

    expect(onConfirm).toHaveBeenCalledWith(50000);
  });

  it("khong xac nhan duoc khi khach dua thieu tien", async () => {
    const user = userEvent.setup();
    render(
      <CashPaymentDialog
        open
        total={37500}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "20000");

    expect(screen.getByRole("button", { name: /^xác nhận/i })).toBeDisabled();
  });

  it("dong khi open la false", () => {
    render(
      <CashPaymentDialog
        open={false}
        total={37500}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("payment-total")).not.toBeInTheDocument();
  });
});

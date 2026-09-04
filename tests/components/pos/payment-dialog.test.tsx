import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
}));

import { PaymentDialog } from "@/components/pos/payment-dialog";
import type { BankAccount } from "@/lib/vietqr/types";

const account: BankAccount = {
  bankBin: "970423",
  accountNumber: "0011012345678",
  accountName: "NGUYEN VAN A",
};

function renderDialog(
  props: Partial<React.ComponentProps<typeof PaymentDialog>> = {},
) {
  return render(
    <PaymentDialog
      open
      total={400000}
      orderCode="DH0001"
      bankAccount={account}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...props}
    />,
  );
}

describe("PaymentDialog", () => {
  it("mac dinh mo tab tien mat", () => {
    renderDialog();
    expect(screen.getByLabelText(/tiền khách đưa/i)).toBeInTheDocument();
  });

  it("hien tong tien phai tra", () => {
    renderDialog();
    expect(screen.getByTestId("payment-total")).toHaveTextContent("400.000");
  });

  it("tinh tien thoi lai o tab tien mat", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "500000");

    expect(screen.getByTestId("payment-change")).toHaveTextContent("100.000");
  });

  it("xac nhan tien mat tra ve mot khoan thanh toan cash", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.type(screen.getByLabelText(/tiền khách đưa/i), "500000");
    await user.click(screen.getByRole("button", { name: /^xác nhận/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    const result = onConfirm.mock.calls[0]![0];
    expect(result.payments).toEqual([{ method: "cash", amount: 400000 }]);
    expect(result.received).toBe(500000);
  });

  it("chuyen sang tab chuyen khoan thi hien ma QR", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));

    expect(await screen.findByTestId("vietqr-canvas")).toBeInTheDocument();
  });

  it("tab chuyen khoan hien noi dung chuyen khoan la ma don", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));

    expect(screen.getByText(/DH0001/)).toBeInTheDocument();
  });

  it("chua cau hinh ngan hang thi bao chua cau hinh", async () => {
    const user = userEvent.setup();
    renderDialog({ bankAccount: null });

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));

    expect(screen.getByText(/chưa cấu hình tài khoản/i)).toBeInTheDocument();
  });

  it("bam Da nhan tien tra ve khoan transfer co receivedAt", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));
    await user.click(screen.getByRole("button", { name: /đã nhận tiền/i }));

    const result = onConfirm.mock.calls[0]![0];
    expect(result.payments[0]?.method).toBe("transfer");
    expect(result.payments[0]?.amount).toBe(400000);
    expect(result.payments[0]?.receivedAt).toBeTruthy();
  });

  it("bam Chua nhan duoc tien tra ve transfer khong co receivedAt", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole("tab", { name: /chuyển khoản/i }));
    await user.click(
      screen.getByRole("button", { name: /chưa nhận được tiền/i }),
    );

    const result = onConfirm.mock.calls[0]![0];
    expect(result.payments[0]?.method).toBe("transfer");
    expect(result.payments[0]?.receivedAt).toBeNull();
  });

  it("tab ghi no bat buoc chon khach truoc khi xac nhan", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("tab", { name: /ghi nợ/i }));

    expect(screen.getByRole("button", { name: /^xác nhận/i })).toBeDisabled();
  });

  it("dong khi open la false", () => {
    renderDialog({ open: false });
    expect(screen.queryByTestId("payment-total")).not.toBeInTheDocument();
  });
});

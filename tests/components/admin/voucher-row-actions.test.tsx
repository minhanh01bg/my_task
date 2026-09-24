import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteVoucherAction,
  toggleVoucherActiveAction,
} from "@/app/admin/promotions/vouchers/actions";
import { VoucherRowActions } from "@/features/admin-vouchers/voucher-row-actions";

vi.mock("@/app/admin/promotions/vouchers/actions", () => ({
  deleteVoucherAction: vi.fn(),
  toggleVoucherActiveAction: vi.fn(),
}));

describe("VoucherRowActions", () => {
  beforeEach(() => {
    vi.mocked(deleteVoucherAction).mockReset();
    vi.mocked(toggleVoucherActiveAction).mockReset();
  });

  it("xoá phải xác nhận trước khi gọi action", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteVoucherAction).mockResolvedValue({
      ok: true,
      message: "Đã xoá",
    });
    render(<VoucherRowActions id="v1" code="GIAM10" isActive />);

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    expect(deleteVoucherAction).not.toHaveBeenCalled();
    expect(await screen.findByText("Xóa mã “GIAM10”?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa mã" }));
    await waitFor(() => expect(deleteVoucherAction).toHaveBeenCalledWith("v1"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("xoá thất bại hiển thị lỗi tại dòng", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteVoucherAction).mockResolvedValue({
      ok: false,
      error: "Không tìm thấy mã giảm giá",
    });
    render(<VoucherRowActions id="v1" code="GIAM10" isActive />);

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.click(await screen.findByRole("button", { name: "Xóa mã" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tìm thấy mã giảm giá",
    );
  });

  it("tạm dừng thất bại hiển thị lỗi, gửi trạng thái ngược lại", async () => {
    const user = userEvent.setup();
    vi.mocked(toggleVoucherActiveAction).mockResolvedValue({
      ok: false,
      error: "Không cập nhật được mã",
    });
    render(<VoucherRowActions id="v1" code="GIAM10" isActive />);

    await user.click(screen.getByRole("button", { name: "Tạm dừng" }));

    expect(toggleVoucherActiveAction).toHaveBeenCalledWith("v1", false);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không cập nhật được mã",
    );
  });
});

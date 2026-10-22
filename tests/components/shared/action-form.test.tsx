import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ActionForm } from "@/components/shared/action-form";
import { reportClientError } from "@/lib/client-log";

vi.mock("@/lib/client-log", () => ({ reportClientError: vi.fn() }));

describe("ActionForm", () => {
  it("action trả { ok: false } thì hiện thông báo dưới nút", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        message: "Chuyển trạng thái không hợp lệ",
      });
    render(
      <ActionForm action={action}>
        <button type="submit">Đã xác nhận</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole("button", { name: "Đã xác nhận" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chuyển trạng thái không hợp lệ",
    );
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("action ném lỗi (mất mạng) thì hiện thông báo thay vì làm sập trang", async () => {
    const user = userEvent.setup();
    const failure = new TypeError("Failed to fetch");
    const action = vi.fn().mockRejectedValue(failure);
    render(
      <ActionForm action={action}>
        <button type="submit">Hủy đơn</button>
      </ActionForm>,
    );

    await user.click(screen.getByRole("button", { name: "Hủy đơn" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thực hiện được, vui lòng thử lại.",
    );
    expect(reportClientError).toHaveBeenCalledWith(
      failure,
      "shared.action-form",
    );
  });

  it("action thành công thì xoá thông báo lỗi cũ", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "Đơn đã hủy" })
      .mockResolvedValueOnce({ ok: true });
    render(
      <ActionForm action={action}>
        <button type="submit">Đánh dấu đã thanh toán</button>
      </ActionForm>,
    );

    const button = screen.getByRole("button", {
      name: "Đánh dấu đã thanh toán",
    });
    await user.click(button);
    expect(await screen.findByRole("alert")).toHaveTextContent("Đơn đã hủy");

    await user.click(button);
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(action).toHaveBeenCalledTimes(2);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { reportClientError } from "@/lib/client-log";

vi.mock("@/lib/client-log", () => ({ reportClientError: vi.fn() }));

function renderConfirm(action: Parameters<typeof ConfirmAction>[0]["action"]) {
  render(
    <ConfirmAction
      action={action}
      triggerLabel="Xóa"
      title="Xóa danh mục “Bánh”?"
      description="Thao tác này không thể hoàn tác."
      confirmLabel="Xóa danh mục"
    />,
  );
}

describe("ConfirmAction", () => {
  it("action trả { ok: false } thì giữ hộp thoại mở và hiện thông báo", async () => {
    const user = userEvent.setup();
    const action = vi
      .fn()
      .mockResolvedValue({ ok: false, message: "Không tìm thấy danh mục." });
    renderConfirm(action);

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.click(
      await screen.findByRole("button", { name: "Xóa danh mục" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tìm thấy danh mục.",
    );
    expect(screen.getByText("Xóa danh mục “Bánh”?")).toBeInTheDocument();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("action ném lỗi (mất mạng) thì giữ hộp thoại, báo lỗi và gửi Sentry", async () => {
    const user = userEvent.setup();
    const failure = new TypeError("Failed to fetch");
    const action = vi.fn().mockRejectedValue(failure);
    renderConfirm(action);

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.click(
      await screen.findByRole("button", { name: "Xóa danh mục" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thực hiện được, vui lòng thử lại.",
    );
    expect(screen.getByText("Xóa danh mục “Bánh”?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xóa danh mục" })).toBeEnabled();
    expect(reportClientError).toHaveBeenCalledWith(
      failure,
      "shared.confirm-action",
    );
  });

  it("action thành công thì đóng hộp thoại, không báo lỗi", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ ok: true });
    renderConfirm(action);

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.click(
      await screen.findByRole("button", { name: "Xóa danh mục" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText("Xóa danh mục “Bánh”?"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("action trả void (tự xử lý lỗi) vẫn đóng hộp thoại như trước", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue(undefined);
    renderConfirm(action);

    await user.click(screen.getByRole("button", { name: "Xóa" }));
    await user.click(
      await screen.findByRole("button", { name: "Xóa danh mục" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByText("Xóa danh mục “Bánh”?"),
      ).not.toBeInTheDocument(),
    );
  });
});

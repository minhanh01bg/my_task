import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ToastProvider, useToast } from "@/components/ui/toast";

function Trigger() {
  const toast = useToast();
  return (
    <button
      type="button"
      onClick={() =>
        toast.add({
          title: "Đã lưu sản phẩm",
          description: "Bugi Wave",
          type: "success",
        })
      }
    >
      Lưu
    </button>
  );
}

describe("Toast", () => {
  it("hiện toast với tiêu đề, mô tả và kiểu", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Lưu" }));

    const title = await screen.findByText("Đã lưu sản phẩm");
    const root = title.closest("[data-slot='toast']");
    expect(root).not.toBeNull();
    expect(root).toHaveAttribute("data-type", "success");
    expect(screen.getByText("Bugi Wave")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Thông báo" })).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("nút đóng gỡ toast", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    const title = await screen.findByText("Đã lưu sản phẩm");

    // Base UI chi mo nut dong cho cong nghe ho tro khi toast duoc mo rong
    // (re chuot / focus) — giong nguoi dung that.
    await user.hover(title);
    await user.click(screen.getByRole("button", { name: "Đóng thông báo" }));

    await waitFor(() =>
      expect(screen.queryByText("Đã lưu sản phẩm")).not.toBeInTheDocument(),
    );
  });

  it("tự đóng sau timeout", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider timeout={50}>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await screen.findByText("Đã lưu sản phẩm");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    await waitFor(() =>
      expect(screen.queryByText("Đã lưu sản phẩm")).not.toBeInTheDocument(),
    );
  });
});

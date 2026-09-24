import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewRowActions } from "@/app/admin/reviews/review-row-actions";
import type { ReviewActionResult } from "@/server/reviews/admin-reviews";

function setup(overrides: {
  hidden?: boolean;
  toggle?: () => Promise<ReviewActionResult>;
  remove?: () => Promise<ReviewActionResult>;
}) {
  const ok = async (): Promise<ReviewActionResult> => ({
    ok: true,
    message: "Đã lưu",
  });
  const toggle = overrides.toggle ?? vi.fn(ok);
  const remove = overrides.remove ?? vi.fn(ok);
  render(
    <ReviewRowActions
      authorName="Minh Anh"
      hidden={overrides.hidden ?? false}
      toggleAction={toggle}
      deleteAction={remove}
    />,
  );
  return { toggle, remove };
}

describe("ReviewRowActions", () => {
  it("xoá cần xác nhận trước khi gọi action", async () => {
    const remove = vi.fn(
      async (): Promise<ReviewActionResult> => ({
        ok: true,
        message: "Đã xoá",
      }),
    );
    setup({ remove });

    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    expect(remove).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/xoá đánh giá của “Minh Anh”\?/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Xoá đánh giá" }));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
  });

  it("hiển thị lỗi khi xoá thất bại", async () => {
    setup({
      remove: async () => ({ ok: false, error: "Không tìm thấy đánh giá" }),
    });
    fireEvent.click(screen.getByRole("button", { name: "Xoá" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Xoá đánh giá" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tìm thấy đánh giá",
    );
  });

  it("ẩn/hiện gọi action ngay và hiển thị lỗi { ok: false }", async () => {
    const toggle = vi.fn(
      async (): Promise<ReviewActionResult> => ({
        ok: false,
        error: "Yêu cầu không hợp lệ",
      }),
    );
    setup({ hidden: true, toggle });

    fireEvent.click(screen.getByRole("button", { name: "Hiện" }));
    await waitFor(() => expect(toggle).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Yêu cầu không hợp lệ",
    );
  });
});

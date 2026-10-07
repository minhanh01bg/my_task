import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import { CategoryForm } from "@/app/(management)/admin/categories/category-form";
import { saveCategoryAction } from "@/app/(management)/admin/categories/actions";

vi.mock("@/app/(management)/admin/categories/actions", () => ({
  saveCategoryAction: vi.fn(),
}));

function setup(category?: { id: string; name: string }) {
  render(
    <ToastProvider>
      <CategoryForm category={category} sortOrder={2} />
    </ToastProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => vi.resetAllMocks());

describe("CategoryForm feedback", () => {
  it("focuses an invalid name and removes the linked error after correction", async () => {
    const user = setup();
    const input = screen.getByRole("textbox", { name: "Tên danh mục mới" });
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "Thêm danh mục" }));
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Vui lòng nhập/);
    expect(saveCategoryAction).not.toHaveBeenCalled();
    await user.type(input, "Đồ uống");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps an edited name when saving fails and permits retry", async () => {
    vi.mocked(saveCategoryAction).mockRejectedValueOnce(new Error("network"));
    vi.mocked(saveCategoryAction).mockResolvedValueOnce({
      ok: true,
      message: "Đã lưu danh mục.",
    });
    const user = setup({ id: "category-1", name: "Cũ" });
    const input = screen.getByRole("textbox", { name: "Tên danh mục Cũ" });
    await user.clear(input);
    await user.type(input, "  Mới  ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await expect(screen.findByRole("alert")).resolves.toHaveTextContent(
      /Không thể lưu/,
    );
    expect(input).toHaveValue("  Mới  ");
    await user.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(input).toHaveValue("Mới"));
    expect(await screen.findByText("Đã lưu danh mục.")).toBeVisible();
    const data = vi.mocked(saveCategoryAction).mock.calls[1][0];
    expect(data.get("id")).toBe("category-1");
    expect(data.get("sortOrder")).toBe("2");
  });

  it("keeps server field errors inline and clears a new name only after success", async () => {
    let rejectName!: (
      value: Awaited<ReturnType<typeof saveCategoryAction>>,
    ) => void;
    vi.mocked(saveCategoryAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          rejectName = resolve;
        }),
    );
    vi.mocked(saveCategoryAction).mockResolvedValueOnce({
      ok: true,
      message: "Đã thêm danh mục.",
    });
    const user = setup();
    const input = screen.getByRole("textbox", { name: "Tên danh mục mới" });
    await user.type(input, "Đồ uống");
    await user.click(screen.getByRole("button", { name: "Thêm danh mục" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Đang lưu…" })).toBeDisabled(),
    );
    expect(input).toHaveAttribute("readonly");
    await act(async () =>
      rejectName({
        ok: false,
        error: "Kiểm tra thông tin",
        fieldErrors: { name: "Tên không hợp lệ" },
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tên không hợp lệ",
    );
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Đồ uống");
    await user.click(screen.getByRole("button", { name: "Thêm danh mục" }));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(await screen.findByText("Đã thêm danh mục.")).toBeVisible();
  });
});

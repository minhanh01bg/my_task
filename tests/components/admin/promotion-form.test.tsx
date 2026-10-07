import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { savePromotionAction } from "@/app/(management)/admin/promotions/actions";
import { ToastProvider } from "@/components/ui/toast";
import { PromotionForm } from "@/features/admin-promotions/promotion-form";

vi.mock("@/app/(management)/admin/promotions/actions", () => ({
  savePromotionAction: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(savePromotionAction).mockResolvedValue({
    ok: false,
    error: "Thông tin không hợp lệ",
  });
});
function setup() {
  render(
    <ToastProvider>
      <PromotionForm />
    </ToastProvider>,
  );
  return userEvent.setup();
}

describe("PromotionForm feedback", () => {
  it("links a blank title error to its input and focuses it", async () => {
    const user = setup();
    const input = screen.getByLabelText(/Tiêu đề khuyến mãi/);
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Tiêu đề không được để trống/);
    expect(input).toHaveFocus();
    expect(savePromotionAction).not.toHaveBeenCalled();
  });

  it("keeps priority, dates and content on failure and resets only after success", async () => {
    vi.mocked(savePromotionAction).mockResolvedValueOnce({
      ok: false,
      error: "Chưa thể lưu",
    });
    vi.mocked(savePromotionAction).mockResolvedValueOnce({
      ok: true,
      message: "Đã tạo chiến dịch",
    });
    const user = setup();
    const title = screen.getByLabelText(/Tiêu đề khuyến mãi/);
    const priority = screen.getByLabelText("Thứ tự ưu tiên");
    const startsAt = screen.getByLabelText(/Thời gian bắt đầu/);
    await user.type(title, "Ưu đãi hè");
    await user.clear(priority);
    await user.type(priority, "8");
    fireEvent.change(startsAt, { target: { value: "2026-11-01T08:00" } });
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể lưu");
    expect(title).toHaveValue("Ưu đãi hè");
    expect(priority).toHaveValue(8);
    expect(startsAt).toHaveValue("2026-11-01T08:00");
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(await screen.findByText("Đã tạo chiến dịch")).toBeVisible();
    await waitFor(() => expect(title).toHaveValue(""));
    expect(priority).toHaveValue(0);
    expect(startsAt).toHaveValue("");
  });

  it("rejects an unsafe link inline before calling the action", async () => {
    const user = setup();
    await user.type(screen.getByLabelText(/Tiêu đề khuyến mãi/), "Ưu đãi");
    const href = screen.getByLabelText(/Đường dẫn.*nút|Đường dẫn CTA/);
    await user.type(href, "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(href).toHaveAttribute("aria-invalid", "true");
    expect(href).toHaveAccessibleDescription(/HTTPS/);
    expect(href).toHaveFocus();
    expect(savePromotionAction).not.toHaveBeenCalled();
  });
  it("keeps invalid image URLs out of the live preview", async () => {
    const user = setup();
    await user.click(screen.getByRole("radio", { name: /Banner đầu trang/ }));
    const image = screen.getByLabelText(/Đường dẫn hình ảnh/);
    await user.type(image, "https://");
    await user.tab();
    expect(image).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    await user.clear(image);
    await user.type(image, "/uploads/banner.jpg");
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      "/uploads/banner.jpg",
    );
  });

  it("focuses the end date when it precedes the start date", async () => {
    const user = setup();
    await user.type(screen.getByLabelText(/Tiêu đề khuyến mãi/), "Ưu đãi");
    fireEvent.change(screen.getByLabelText(/Thời gian bắt đầu/), {
      target: { value: "2026-11-02T08:00" },
    });
    const end = screen.getByLabelText(/Thời gian kết thúc/);
    fireEvent.change(end, { target: { value: "2026-11-01T08:00" } });
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveFocus();
    expect(savePromotionAction).not.toHaveBeenCalled();
  });
});

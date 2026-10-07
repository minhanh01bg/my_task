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

async function chooseDay(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  day: number,
) {
  await user.click(screen.getByRole("button", { name: label }));
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth(), day);
  await user.click(
    screen.getByRole("button", {
      name: date.toLocaleDateString("vi-VN", { dateStyle: "full" }),
    }),
  );
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
    const startsAt = screen.getByRole("button", {
      name: "Ngày bắt đầu",
    });
    await user.type(title, "Ưu đãi hè");
    await user.clear(priority);
    await user.type(priority, "8");
    const selected = await chooseDay(user, "Ngày bắt đầu", 15);
    const time = screen.getByLabelText("Giờ bắt đầu");
    fireEvent.change(time, { target: { value: "08:00" } });
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Chưa thể lưu");
    await waitFor(() =>
      expect(
        screen.getByRole("form", { name: "Tạo chiến dịch" }),
      ).toHaveAttribute("aria-busy", "false"),
    );
    expect(title).toHaveValue("Ưu đãi hè");
    expect(priority).toHaveValue(8);
    expect(startsAt).toHaveTextContent("15/");
    expect(time).toHaveValue("08:00");
    expect(
      vi.mocked(savePromotionAction).mock.calls[0][1].get("startsAt"),
    ).toBe(`${selected}T08:00`);
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(await screen.findByText("Đã tạo chiến dịch")).toBeVisible();
    await waitFor(() => expect(title).toHaveValue(""));
    expect(priority).toHaveValue(0);
    expect(startsAt).toHaveTextContent("Chọn ngày");
    expect(time).toHaveValue("");
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
    await chooseDay(user, "Ngày bắt đầu", 16);
    await chooseDay(user, "Ngày kết thúc", 15);
    const end = screen.getByRole("button", {
      name: "Ngày kết thúc",
    });
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(end).toHaveAttribute("aria-invalid", "true");
    expect(end).toHaveFocus();
    expect(savePromotionAction).not.toHaveBeenCalled();
  });
  it("clears the selected day and hour together", async () => {
    const user = setup();
    await chooseDay(user, "Ngày bắt đầu", 15);
    fireEvent.change(screen.getByLabelText("Giờ bắt đầu"), {
      target: { value: "08:30" },
    });
    await user.click(screen.getByRole("button", { name: "Ngày bắt đầu" }));
    await user.click(screen.getByRole("button", { name: "Xóa ngày" }));
    expect(
      screen.getByRole("button", { name: "Ngày bắt đầu" }),
    ).toHaveTextContent("Chọn ngày");
    expect(screen.getByLabelText("Giờ bắt đầu")).toHaveValue("");
    expect(screen.getByLabelText("Giờ bắt đầu")).toBeDisabled();
  });
  it("focuses the calendar and keeps its value on a server date error", async () => {
    vi.mocked(savePromotionAction).mockResolvedValueOnce({
      ok: false,
      error: "Lịch không hợp lệ",
      fieldErrors: { startsAt: "Lịch không hợp lệ" },
    });
    const user = setup();
    await user.type(screen.getByLabelText(/Tiêu đề khuyến mãi/), "Ưu đãi");
    await chooseDay(user, "Ngày bắt đầu", 15);
    await user.click(screen.getByRole("button", { name: "Tạo chiến dịch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lịch không hợp lệ",
    );
    const date = screen.getByRole("button", {
      name: "Ngày bắt đầu",
    });
    expect(date).toHaveFocus();
    expect(date).toHaveAccessibleDescription("Lịch không hợp lệ");
    expect(date).toHaveTextContent("15/");
  });
});

import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/features/admin-navigation/admin-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/orders",
}));

vi.mock("@/features/admin-notifications/notification-button", () => ({
  NotificationButton: ({ placement }: { placement?: string }) => (
    <button type="button">Thông báo {placement}</button>
  ),
}));

describe("AdminNav", () => {
  it("có top bar, bottom navigation và trạng thái trang hiện tại", () => {
    render(<AdminNav />);

    expect(screen.getByText("Quản lý")).toBeInTheDocument();
    const mobileNav = screen.getByRole("navigation", {
      name: "Điều hướng quản lý trên điện thoại",
    });
    expect(within(mobileNav).getByText("Bán hàng")).toBeInTheDocument();
    expect(
      within(mobileNav).getByText("Đơn hàng").closest("a"),
    ).toHaveAttribute("aria-current", "page");
  });

  it("mở menu đầy đủ và đóng sau khi chọn chức năng", () => {
    render(<AdminNav />);

    fireEvent.click(
      screen.getByRole("button", { name: "Mở toàn bộ menu quản lý" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Menu quản lý",
    });
    expect(within(dialog).getByText("Công nợ")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("link", { name: /Công nợ/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("có skip link đến nội dung chính", () => {
    render(<AdminNav />);
    expect(screen.getByRole("link", { name: "Bỏ qua menu" })).toHaveAttribute(
      "href",
      "#admin-main-content",
    );
  });

  it("đóng menu bằng phím Escape và trả focus về nút mở", async () => {
    render(<AdminNav />);
    const trigger = screen.getByRole("button", {
      name: "Mở toàn bộ menu quản lý",
    });

    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});

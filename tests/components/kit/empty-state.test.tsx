import { render, screen } from "@testing-library/react";
import { Bell } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/kit/empty-state";

describe("EmptyState", () => {
  it("hien tieu de, loi dan va hanh dong", () => {
    render(
      <EmptyState
        title="Chưa có đơn hàng"
        description="Đơn mới sẽ hiện ở đây."
        action={<button type="button">Tạo đơn</button>}
      />,
    );
    expect(screen.getByText("Chưa có đơn hàng")).toBeInTheDocument();
    expect(screen.getByText("Đơn mới sẽ hiện ở đây.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo đơn" })).toBeInTheDocument();
  });

  it("gan data-slot de trang goi va test nhan ra cung mot thanh phan", () => {
    const { container } = render(<EmptyState title="Trống" />);
    expect(container.firstChild).toHaveAttribute("data-slot", "empty-state");
  });

  it("icon la trang tri, an khoi trinh doc man hinh", () => {
    const { container } = render(
      <EmptyState title="Chưa có thông báo" icon={Bell} />,
    );
    const icon = container.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon).toHaveClass("lucide-bell");
  });

  it("ban gon cho panel hep", () => {
    const { container } = render(<EmptyState title="Trống" size="compact" />);
    expect(container.firstChild).toHaveAttribute("data-size", "compact");
  });

  it("co the dong vai tro status khi la ket qua tim kiem", () => {
    render(<EmptyState title="Không tìm thấy" role="status" />);
    expect(screen.getByRole("status")).toHaveTextContent("Không tìm thấy");
  });
});

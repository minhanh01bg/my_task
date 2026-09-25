import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "@/components/kit/error-state";

describe("ErrorState component", () => {
  it("renders default title, description and retry button", () => {
    const handleRetry = vi.fn();
    render(
      <ErrorState
        title="Không thể tải dữ liệu"
        description="Vui lòng kiểm tra kết nối mạng và thử lại."
        onRetry={handleRetry}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Không thể tải dữ liệu")).toBeInTheDocument();
    expect(
      screen.getByText("Vui lòng kiểm tra kết nối mạng và thử lại."),
    ).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: "Thử lại" });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it("supports custom retry label and hides button when onRetry is not provided", () => {
    const { rerender } = render(
      <ErrorState
        title="Lỗi xử lý"
        onRetry={() => {}}
        retryLabel="Tải lại ngay"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Tải lại ngay" }),
    ).toBeInTheDocument();

    rerender(<ErrorState title="Lỗi nghiêm trọng" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("supports compact size for panels and widgets", () => {
    const { container } = render(
      <ErrorState title="Lỗi nhỏ" size="compact" onRetry={() => {}} />,
    );

    expect(
      container.querySelector('[data-size="compact"]'),
    ).toBeInTheDocument();
  });
});

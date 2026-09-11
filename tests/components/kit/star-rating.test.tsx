import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StarRating } from "@/components/kit/star-rating";

describe("StarRating component", () => {
  it("hiển thị chính xác số sao và lượt đánh giá ở chế độ hiển thị", () => {
    render(<StarRating rating={4.5} reviewCount={128} size="sm" />);

    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(128 đánh giá)")).toBeInTheDocument();
  });

  it("cho phép người dùng tương tác chọn điểm đánh giá khi interactive=true", () => {
    const handleChange = vi.fn();
    render(
      <StarRating
        rating={0}
        interactive
        onChange={handleChange}
        aria-label="Chọn số sao đánh giá"
      />,
    );

    const starButtons = screen.getAllByRole("button");
    expect(starButtons).toHaveLength(5);

    // Nhấp vào ngôi sao thứ 5
    fireEvent.click(starButtons[4]);
    expect(handleChange).toHaveBeenCalledWith(5);

    // Nhấp vào ngôi sao thứ 3
    fireEvent.click(starButtons[2]);
    expect(handleChange).toHaveBeenCalledWith(3);
  });

  it("hiển thị nhãn mô tả mức độ hài lòng khi chọn sao", () => {
    render(<StarRating rating={5} showLabel />);
    expect(screen.getByText(/tuyệt vời/i)).toBeInTheDocument();
  });
});

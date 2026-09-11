import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { WishlistButton } from "@/components/kit/wishlist-button";

describe("WishlistButton component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("thay đổi trạng thái yêu thích khi click", () => {
    render(<WishlistButton productId="p-test-1" productName="Bánh quy bơ" />);

    const button = screen.getByRole("button", { name: /yêu thích/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-pressed", "false");

    // Click lần 1: Thêm vào yêu thích
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");

    // Click lần 2: Bỏ khỏi yêu thích
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});

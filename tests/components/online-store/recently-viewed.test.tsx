import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { RecentlyViewedSection } from "@/features/online-store/recently-viewed";
import { recordRecentlyViewed } from "@/lib/storage/recently-viewed";

function renderWithCart(ui: React.ReactNode) {
  return render(<OnlineCartProvider>{ui}</OnlineCartProvider>);
}

describe("RecentlyViewedSection Component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("không hiển thị khi chưa có sản phẩm nào vừa xem", () => {
    const { container } = renderWithCart(<RecentlyViewedSection />);
    expect(container.firstChild).toBeNull();
  });

  it("hiển thị các sản phẩm trong lịch sử vừa xem", () => {
    recordRecentlyViewed({
      id: "p1",
      name: "Bánh quy bơ hộp thiếc 500g",
      price: 95000,
      unit: "hộp",
      stock: 12,
    });

    renderWithCart(<RecentlyViewedSection />);

    expect(screen.getByText(/sản phẩm bạn vừa xem/i)).toBeInTheDocument();
    expect(screen.getByText("Bánh quy bơ hộp thiếc 500g")).toBeInTheDocument();
  });

  it("cho phép người dùng xóa lịch sử xem", () => {
    recordRecentlyViewed({
      id: "p1",
      name: "Bánh quy bơ hộp thiếc 500g",
      price: 95000,
      unit: "hộp",
      stock: 12,
    });

    renderWithCart(<RecentlyViewedSection />);

    const clearBtn = screen.getByRole("button", { name: /xóa lịch sử/i });
    fireEvent.click(clearBtn);

    expect(screen.queryByText(/sản phẩm bạn vừa xem/i)).not.toBeInTheDocument();
  });
});

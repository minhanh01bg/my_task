import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { QuickViewModal } from "@/features/online-store/quick-view-modal";
import type { OnlineProduct } from "@/features/online-store/types";

const mockProduct: OnlineProduct = {
  id: "p-quick",
  name: "Nước khoáng thiên nhiên 500ml",
  price: 8000,
  unit: "chai",
  stock: 24,
  soldCount: 120,
  imageUrl: null,
  categoryId: "cat-drinks",
  searchText: "nuoc khoang thien nhien 500ml",
};

function renderWithCart(ui: React.ReactNode) {
  return render(<OnlineCartProvider>{ui}</OnlineCartProvider>);
}

describe("QuickViewModal Component", () => {
  it("không hiển thị khi product là null", () => {
    const { container } = renderWithCart(
      <QuickViewModal product={null} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("render thông tin chi tiết sản phẩm, giá và số lượng", () => {
    renderWithCart(<QuickViewModal product={mockProduct} onClose={vi.fn()} />);

    expect(
      screen.getByText("Nước khoáng thiên nhiên 500ml"),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/chai/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("button", { name: /thêm vào giỏ/i }),
    ).toBeInTheDocument();
  });

  it("cho phép tăng giảm số lượng mua trong modal", () => {
    renderWithCart(<QuickViewModal product={mockProduct} onClose={vi.fn()} />);

    const qtyDisplay = screen.getByLabelText("Số lượng mua");
    expect(qtyDisplay).toHaveTextContent("1");

    const plusBtn = screen.getByLabelText("Tăng số lượng");
    fireEvent.click(plusBtn);
    expect(qtyDisplay).toHaveTextContent("2");

    const minusBtn = screen.getByLabelText("Giảm số lượng");
    fireEvent.click(minusBtn);
    expect(qtyDisplay).toHaveTextContent("1");
  });

  it("gọi onClose khi bấm nút đóng hoặc phím Escape", () => {
    const onClose = vi.fn();
    renderWithCart(<QuickViewModal product={mockProduct} onClose={onClose} />);

    const closeBtn = screen.getByLabelText("Đóng xem nhanh");
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

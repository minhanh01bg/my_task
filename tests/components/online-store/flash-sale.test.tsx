import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { FlashSaleSection } from "@/features/online-store/landing/flash-sale-section";
import type { OnlineProduct } from "@/features/online-store/types";

const mockProducts: OnlineProduct[] = [
  {
    id: "p1",
    name: "Dầu ăn thực vật cao cấp 1L",
    price: 45000,
    unit: "chai",
    stock: 50,
    soldCount: 32,
    imageUrl: null,
    categoryId: "cat-1",
    searchText: "dau an thuc vat cao cap 1l",
  },
  {
    id: "p2",
    name: "Gạo thơm ST25 túi 5kg",
    price: 165000,
    unit: "túi",
    stock: 20,
    soldCount: 15,
    imageUrl: null,
    categoryId: "cat-1",
    searchText: "gao thom st25 tui 5kg",
  },
];

function renderWithCart(ui: React.ReactNode) {
  return render(<OnlineCartProvider>{ui}</OnlineCartProvider>);
}

describe("FlashSaleSection Component", () => {
  it("render tiêu đề Flash Sale và đồng hồ đếm ngược", () => {
    renderWithCart(<FlashSaleSection products={mockProducts} />);
    expect(screen.getByText(/FLASH SALE/i)).toBeInTheDocument();
    expect(screen.getByText("Dầu ăn thực vật cao cấp 1L")).toBeInTheDocument();
  });

  it("hiển thị thanh tiến độ bán hàng và huy hiệu giảm giá", () => {
    renderWithCart(<FlashSaleSection products={mockProducts} />);
    expect(screen.getAllByText(/Đã bán/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/-\d+%/i).length).toBeGreaterThanOrEqual(1);
  });

  it("không render nếu danh sách sản phẩm rỗng", () => {
    const { container } = renderWithCart(<FlashSaleSection products={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

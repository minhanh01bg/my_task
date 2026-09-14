import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductFilters } from "@/app/admin/products/product-filters";
import type { CatalogCategory } from "@/types/catalog";

const push = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
  useRouter: () => ({ push }),
  useSearchParams: () => mockSearchParams,
}));

const mockCategories: CatalogCategory[] = [
  { id: "cat-1", name: "Đồ uống", sortOrder: 0 },
  { id: "cat-2", name: "Bánh kẹo", sortOrder: 1 },
];

const mockCounts = {
  all: 45,
  low: 6,
  out: 2,
  negative: 1,
  available: 36,
};

describe("ProductFilters (Admin)", () => {
  it("hiển thị đầy đủ các tab trạng thái tồn kho kèm số lượng thống kê chính xác", () => {
    mockSearchParams = new URLSearchParams();
    render(
      <ProductFilters
        categories={mockCategories}
        currentStatus="all"
        counts={mockCounts}
      />,
    );

    expect(screen.getByRole("tab", { name: /tất cả/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /cảnh báo tồn thấp/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /hết hàng/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /tồn âm/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /còn hàng/i })).toBeInTheDocument();

    // Kiểm tra số lượng
    expect(screen.getByText("45")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("36")).toBeInTheDocument();
  });

  it("chuyển tab lọc sang 'low' khi người dùng click vào tab Cảnh báo tồn thấp", () => {
    mockSearchParams = new URLSearchParams();
    push.mockClear();

    render(
      <ProductFilters
        categories={mockCategories}
        currentStatus="all"
        counts={mockCounts}
      />,
    );

    const lowStockTab = screen.getByRole("tab", { name: /cảnh báo tồn thấp/i });
    fireEvent.click(lowStockTab);

    expect(push).toHaveBeenCalledWith(expect.stringContaining("status=low"));
  });

  it("cho phép tìm kiếm sản phẩm theo từ khóa", async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams();
    push.mockClear();

    render(
      <ProductFilters
        categories={mockCategories}
        currentQuery=""
        counts={mockCounts}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      /tìm theo tên sản phẩm, mã sku/i,
    );
    await user.type(searchInput, "Trà xanh");

    const searchBtn = screen.getByRole("button", { name: /^tìm kiếm$/i });
    await user.click(searchBtn);

    expect(push).toHaveBeenCalledWith(
      expect.stringContaining("q=Tr%C3%A0+xanh"),
    );
  });

  it("hiển thị nút 'Đặt lại' khi có bộ lọc hoạt động và xóa bộ lọc khi bấm", () => {
    mockSearchParams = new URLSearchParams("status=low&q=tra");
    push.mockClear();

    render(
      <ProductFilters
        categories={mockCategories}
        currentStatus="low"
        currentQuery="tra"
        counts={mockCounts}
      />,
    );

    const resetBtn = screen.getByRole("button", { name: /đặt lại/i });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(push).toHaveBeenCalledWith("/admin/products");
  });
});

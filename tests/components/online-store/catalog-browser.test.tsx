import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";

const replace = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
  useRouter: () => ({ replace }),
  useSearchParams: () => mockSearchParams,
}));

const catalog = {
  categories: [{ id: "c1", name: "Nước uống" }],
  products: [
    {
      id: "p1",
      name: "Cà phê sữa",
      price: 20_000,
      unit: "chai",
      stock: 5,
      imageUrl: null,
      categoryId: "c1",
      searchText: "ca phe sua",
    },
    {
      id: "p2",
      name: "Bánh mì",
      price: 10_000,
      unit: "cái",
      stock: 0,
      imageUrl: null,
      categoryId: null,
      searchText: "banh mi",
    },
  ],
};

describe("CatalogBrowser", () => {
  it("tìm bỏ dấu và khóa sản phẩm hết hàng", async () => {
    const user = userEvent.setup();
    render(
      <OnlineCartProvider>
        <CatalogBrowser catalog={catalog} />
      </OnlineCartProvider>,
    );
    await user.type(screen.getByPlaceholderText("Tìm tên sản phẩm…"), "ca phe");
    expect(screen.getByText("Cà phê sữa")).toBeInTheDocument();
    expect(screen.queryByText("Bánh mì")).not.toBeInTheDocument();
  });

  it("thêm vào giỏ phát sinh feedback trực quan cho người dùng", async () => {
    const user = userEvent.setup();
    render(
      <OnlineCartProvider>
        <CatalogBrowser catalog={catalog} />
      </OnlineCartProvider>,
    );

    const addButtons = screen.getAllByRole("button", {
      name: /thêm .* vào giỏ/i,
    });
    await user.click(addButtons[0]);

    expect(screen.getByRole("status")).toHaveTextContent("Cà phê sữa");
    expect(screen.getByRole("status")).toHaveTextContent("1");
  });

  it("lọc theo trạng thái chỉ hiện còn hàng loại bỏ sản phẩm hết hàng", async () => {
    const user = userEvent.setup();
    render(
      <OnlineCartProvider>
        <CatalogBrowser catalog={catalog} />
      </OnlineCartProvider>,
    );

    expect(screen.getByText("Bánh mì")).toBeInTheDocument();

    const inStockCheckbox = screen.getByLabelText(/chỉ hiện còn hàng/i);
    await user.click(inStockCheckbox);

    expect(screen.getByText("Cà phê sữa")).toBeInTheDocument();
    expect(screen.queryByText("Bánh mì")).not.toBeInTheDocument();
  });

  it("hiển thị empty state khi không khớp và nút xóa tất cả bộ lọc khôi phục danh sách", async () => {
    const user = userEvent.setup();
    render(
      <OnlineCartProvider>
        <CatalogBrowser catalog={catalog} />
      </OnlineCartProvider>,
    );

    await user.type(
      screen.getByPlaceholderText("Tìm tên sản phẩm…"),
      "từ khóa không tồn tại xyz",
    );
    expect(screen.getByText(/không tìm thấy sản phẩm/i)).toBeInTheDocument();

    const clearButton = screen.getByRole("button", {
      name: /xóa tất cả bộ lọc/i,
    });
    await user.click(clearButton);

    expect(screen.getByText("Cà phê sữa")).toBeInTheDocument();
    expect(screen.getByText("Bánh mì")).toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CartPanel } from "@/components/pos/cart-panel";
import { useCartStore } from "@/stores/cart-store";
import type { SearchableProduct } from "@/lib/search/types";

const sugar: SearchableProduct = {
  id: "p1",
  name: "Đường trắng",
  sku: null,
  price: 15000,
  unit: "kg",
  stock: 10,
  categoryId: null,
  soldCount: 0,
  imageUrl: null,
  searchText: "duong trang",
};

beforeEach(() => {
  useCartStore.getState().clear();
});

describe("CartPanel", () => {
  it("gio rong thi bao chua co gi", () => {
    render(<CartPanel onCheckout={vi.fn()} />);
    expect(screen.getByText(/chưa có sản phẩm/i)).toBeInTheDocument();
  });

  it("hien dong hang va thanh tien", () => {
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    expect(screen.getByText("Đường trắng")).toBeInTheDocument();
    expect(screen.getAllByText(/15\.000/).length).toBeGreaterThan(0);
  });

  it("danh sach hang cuon doc de khong day nut thanh toan khoi man hinh", () => {
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    const list = screen.getByRole("list");
    expect(list).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(
      screen.getByRole("button", { name: /thanh toán/i }).parentElement,
    ).toHaveClass("shrink-0");
  });

  it("controls co the co lai va xuong dong, khong tran len thanh tien", () => {
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    expect(screen.getByTestId("cart-line-controls")).toHaveClass(
      "min-w-0",
      "grid-cols-1",
    );
    expect(screen.getByText("Số lượng · kg")).toBeInTheDocument();
    expect(screen.getByText("Đơn giá · bước 1.000đ")).toBeInTheDocument();
  });

  it("hien tong tien cong don nhieu dong", () => {
    useCartStore.getState().addProduct(sugar);
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    expect(screen.getByTestId("cart-total")).toHaveTextContent("30.000");
  });

  it("sua so luong le cap nhat thanh tien", async () => {
    const user = userEvent.setup();
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    const quantityInput = screen.getByLabelText(/số lượng/i);
    await user.clear(quantityInput);
    await user.type(quantityInput, "2.5");

    expect(screen.getByTestId("cart-total")).toHaveTextContent("37.500");
  });

  it("de gia cap nhat thanh tien", async () => {
    const user = userEvent.setup();
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    const priceInput = screen.getByRole("spinbutton", { name: /^đơn giá/i });
    await user.clear(priceInput);
    await user.type(priceInput, "12000");

    expect(screen.getByTestId("cart-total")).toHaveTextContent("12.000");
  });

  it("nut gia tang giam moi lan 1.000 dong va khong am", async () => {
    const user = userEvent.setup();
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    await user.click(
      screen.getByRole("button", { name: /tăng đơn giá.*1\.000 đồng/i }),
    );
    expect(screen.getByTestId("cart-total")).toHaveTextContent("16.000");

    await user.click(
      screen.getByRole("button", { name: /giảm đơn giá.*1\.000 đồng/i }),
    );
    expect(screen.getByTestId("cart-total")).toHaveTextContent("15.000");

    const priceInput = screen.getByRole("spinbutton", { name: /^đơn giá/i });
    await user.clear(priceInput);
    await user.type(priceInput, "500");
    await user.click(
      screen.getByRole("button", { name: /giảm đơn giá.*1\.000 đồng/i }),
    );
    expect(priceInput).toHaveValue(0);
  });

  it("xoa dong khoi gio", async () => {
    const user = userEvent.setup();
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /xoá dòng/i }));

    expect(screen.getByText(/chưa có sản phẩm/i)).toBeInTheDocument();
  });

  it("xoa ca don phai xac nhan truoc", async () => {
    const user = userEvent.setup();
    useCartStore.getState().addProduct(sugar);
    useCartStore.getState().addService("Công giao hàng", 20000);
    render(<CartPanel onCheckout={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /xóa cả đơn/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/2 mặt hàng/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/35\.000/)).toBeInTheDocument();
    expect(screen.getByText("Đường trắng")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /xóa toàn bộ đơn/i }));

    expect(screen.getByText(/chưa có sản phẩm/i)).toBeInTheDocument();
  });

  it("hien don vi tinh ben canh so luong", () => {
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={vi.fn()} />);

    expect(screen.getByText("Số lượng · kg")).toBeInTheDocument();
  });

  it("nut thanh toan bi khoa khi gio rong", () => {
    render(<CartPanel onCheckout={vi.fn()} />);
    expect(screen.getByRole("button", { name: /thanh toán/i })).toBeDisabled();
  });

  it("bam thanh toan goi onCheckout", async () => {
    const user = userEvent.setup();
    const onCheckout = vi.fn();
    useCartStore.getState().addProduct(sugar);
    render(<CartPanel onCheckout={onCheckout} />);

    await user.click(screen.getByRole("button", { name: /thanh toán/i }));

    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it("dong dich vu hien trong gio", () => {
    useCartStore.getState().addService("Công thay nhớt", 20000);
    render(<CartPanel onCheckout={vi.fn()} />);

    expect(screen.getByText("Công thay nhớt")).toBeInTheDocument();
    expect(screen.getByTestId("cart-total")).toHaveTextContent("20.000");
  });
});

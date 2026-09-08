import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  OnlineCartProvider,
  useOnlineCart,
} from "@/features/online-store/cart-context";
import { CartFeedback } from "@/features/online-store/cart-feedback";
import type { OnlineProduct } from "@/features/online-store/types";

const mockProduct: OnlineProduct = {
  id: "p1",
  name: "Cà phê Robusta",
  price: 50_000,
  unit: "gói",
  stock: 2,
  imageUrl: null,
  categoryId: "c1",
  searchText: "ca phe robusta",
};

const mockOutOfStockProduct: OnlineProduct = {
  id: "p2",
  name: "Bánh quy bơ",
  price: 30_000,
  unit: "hộp",
  stock: 0,
  imageUrl: null,
  categoryId: "c2",
  searchText: "banh quy bo",
};

function TestTriggerComponent({ product }: { product: OnlineProduct }) {
  const { add } = useOnlineCart();
  return (
    <div>
      <button onClick={() => add(product)}>Thêm vào giỏ</button>
      <CartFeedback />
    </div>
  );
}

describe("CartFeedback and cart mutation feedback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("thêm sản phẩm vào giỏ trả feedback chứa tên sản phẩm và quantity 1", () => {
    render(
      <OnlineCartProvider>
        <TestTriggerComponent product={mockProduct} />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm vào giỏ"));

    expect(screen.getByRole("status")).toHaveTextContent("Cà phê Robusta");
    expect(screen.getByRole("status")).toHaveTextContent("1");
  });

  it("click liên tiếp increment đúng và khi đạt stock cap phải báo Đã đạt số lượng tối đa", () => {
    render(
      <OnlineCartProvider>
        <TestTriggerComponent product={mockProduct} />
      </OnlineCartProvider>,
    );

    const button = screen.getByText("Thêm vào giỏ");
    fireEvent.click(button); // Qty = 1 (added)
    expect(screen.getByRole("status")).toHaveTextContent("1");

    fireEvent.click(button); // Qty = 2 (incremented, max stock = 2)
    expect(screen.getByRole("status")).toHaveTextContent("2");

    fireEvent.click(button); // Stock cap hit
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đã đạt số lượng tối đa",
    );
  });

  it("sản phẩm unavailable không mutate và không phát success feedback", () => {
    render(
      <OnlineCartProvider>
        <TestTriggerComponent product={mockOutOfStockProduct} />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm vào giỏ"));
    expect(screen.getByRole("status")).toHaveTextContent(
      /hết hàng|không khả dụng/i,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("Đã thêm");
  });

  it("toast có thể chủ động đóng bằng nút dismiss", () => {
    render(
      <OnlineCartProvider>
        <TestTriggerComponent product={mockProduct} />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm vào giỏ"));
    expect(screen.getByRole("status")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /đóng thông báo/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("toast tự động biến mất sau thời gian timeout", () => {
    vi.useFakeTimers();
    render(
      <OnlineCartProvider>
        <TestTriggerComponent product={mockProduct} />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm vào giỏ"));
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

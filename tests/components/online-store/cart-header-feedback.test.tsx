import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OnlineCartProvider,
  useOnlineCart,
} from "@/features/online-store/cart-context";
import { StoreHeader } from "@/features/online-store/store-header";
import { DEFAULT_SHIPPING_SETTINGS } from "@/lib/shipping/shipping-fee";
import type { OnlineProduct } from "@/features/online-store/types";

const mockProduct: OnlineProduct = {
  id: "p1",
  name: "Trà xanh ô long",
  price: 35000,
  unit: "gói",
  stock: 10,
  imageUrl: null,
  categoryId: "c1",
  searchText: "tra xanh o long",
};

function TestWrapper() {
  const { add, setQuantity } = useOnlineCart();
  return (
    <div>
      <StoreHeader
        storeName="Cửa Hàng Test"
        shipping={DEFAULT_SHIPPING_SETTINGS}
      />
      <button onClick={() => add(mockProduct)}>Thêm vào giỏ</button>
      <button onClick={() => setQuantity(mockProduct.id, 1)}>Giảm về 1</button>
    </div>
  );
}

describe("StoreHeader Cart Badge Feedback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hiển thị số lượng giỏ hàng ban đầu bằng 0", () => {
    render(
      <OnlineCartProvider>
        <TestWrapper />
      </OnlineCartProvider>,
    );

    expect(screen.getByText("Giỏ hàng")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("cập nhật số lượng và áp dụng animation khi thêm sản phẩm", () => {
    render(
      <OnlineCartProvider>
        <TestWrapper />
      </OnlineCartProvider>,
    );

    const addBtn = screen.getByText("Thêm vào giỏ");
    fireEvent.click(addBtn);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("không nhún badge khi số lượng giảm sau các lần thêm", () => {
    vi.useFakeTimers();
    render(
      <OnlineCartProvider>
        <TestWrapper />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm vào giỏ"));
    act(() => vi.advanceTimersByTime(500));
    fireEvent.click(screen.getByText("Thêm vào giỏ"));
    act(() => vi.advanceTimersByTime(500));

    fireEvent.click(screen.getByText("Giảm về 1"));

    const badge = screen.getByText("1");
    expect(badge).not.toHaveClass("animate-badge-bounce");
  });
});

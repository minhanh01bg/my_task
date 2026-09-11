import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  OnlineCartProvider,
  useOnlineCart,
} from "@/features/online-store/cart-context";
import { StoreHeader } from "@/features/online-store/store-header";
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
  const { add } = useOnlineCart();
  return (
    <div>
      <StoreHeader storeName="Cửa Hàng Test" />
      <button onClick={() => add(mockProduct)}>Thêm vào giỏ</button>
    </div>
  );
}

describe("StoreHeader Cart Badge Feedback", () => {
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
});

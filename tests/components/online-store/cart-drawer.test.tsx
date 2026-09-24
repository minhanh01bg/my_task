import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import {
  OnlineCartProvider,
  useOnlineCart,
} from "@/features/online-store/cart-context";
import { CartDrawer } from "@/features/online-store/cart-drawer";
import type { OnlineProduct } from "@/features/online-store/types";

const mockProductA: OnlineProduct = {
  id: "p1",
  name: "Cà phê Robusta",
  price: 50_000,
  unit: "gói",
  stock: 3,
  imageUrl: null,
  categoryId: "c1",
  searchText: "ca phe robusta",
};

const mockProductB: OnlineProduct = {
  id: "p2",
  name: "Trà lài",
  price: 40_000,
  unit: "hộp",
  stock: 10,
  imageUrl: null,
  categoryId: "c1",
  searchText: "tra lai",
};

function TestContainer() {
  const { add, openDrawer } = useOnlineCart();
  return (
    <div>
      <button onClick={openDrawer}>Mở giỏ hàng</button>
      <button onClick={() => add(mockProductA)}>Thêm A</button>
      <button onClick={() => add(mockProductB)}>Thêm B</button>
      <CartDrawer />
    </div>
  );
}

describe("CartDrawer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hiển thị empty state khi giỏ hàng chưa có sản phẩm", () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/giỏ hàng.*trống/i)).toBeInTheDocument();
    // Nút thanh toán bị vô hiệu hóa hoặc không cho checkout khi giỏ rỗng
    expect(
      screen.queryByRole("link", { name: /tiến hành đặt hàng/i }),
    ).not.toBeInTheDocument();
  });

  it("hiển thị danh sách sản phẩm, số lượng, đơn giá và tổng tạm tính", () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm A")); // 50,000 x 1
    fireEvent.click(screen.getByText("Thêm B")); // 40,000 x 1
    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Cà phê Robusta")).toBeInTheDocument();
    expect(screen.getByText("Trà lài")).toBeInTheDocument();

    // Tổng tiền 90,000 ₫
    expect(screen.getByTestId("cart-subtotal")).toHaveTextContent("90.000");

    // Có nút Tiến hành đặt hàng dẫn tới /checkout
    const checkoutLink = screen.getByRole("link", {
      name: /tiến hành đặt hàng/i,
    });
    expect(checkoutLink).toHaveAttribute("href", "/checkout");
  });

  it("cho phép tăng giảm số lượng và chặn vượt tồn kho", () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm A")); // stock = 3, qty = 1
    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    const increaseBtn = screen.getByRole("button", {
      name: /tăng số lượng.*cà phê robusta/i,
    });
    const decreaseBtn = screen.getByRole("button", {
      name: /giảm số lượng.*cà phê robusta/i,
    });

    // Qty: 1 -> 2
    fireEvent.click(increaseBtn);
    expect(screen.getByTestId("quantity-p1")).toHaveTextContent("2");
    expect(screen.getByTestId("cart-subtotal")).toHaveTextContent("100.000");

    // Qty: 2 -> 3 (đạt max stock 3)
    fireEvent.click(increaseBtn);
    expect(screen.getByTestId("quantity-p1")).toHaveTextContent("3");
    expect(increaseBtn).toBeDisabled();

    // Giảm: 3 -> 2
    fireEvent.click(decreaseBtn);
    expect(screen.getByTestId("quantity-p1")).toHaveTextContent("2");
    expect(increaseBtn).not.toBeDisabled();
  });

  it("cho phép xóa sản phẩm khỏi giỏ hàng", () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm A"));
    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    expect(screen.getByText("Cà phê Robusta")).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", {
      name: /xóa.*cà phê robusta/i,
    });
    fireEvent.click(removeBtn);

    expect(screen.queryByText("Cà phê Robusta")).not.toBeInTheDocument();
    expect(screen.getByText(/giỏ hàng.*trống/i)).toBeInTheDocument();
  });

  it("đóng drawer bằng phím Escape hoặc nút đóng", () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Mở giỏ hàng"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Đóng bằng nút X
    const closeBtn = screen.getByRole("button", { name: /đóng giỏ hàng/i });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Mở lại và đóng bằng Escape
    fireEvent.click(screen.getByText("Mở giỏ hàng"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("là sheet có tên, khoá cuộn trang và trả focus về nút mở", async () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    const opener = screen.getByText("Mở giỏ hàng");
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Giỏ hàng của bạn" });
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute(
        "data-base-ui-scroll-locked",
      ),
    );

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("hiển thị thanh tiến độ Free Shipping khi tổng tiền dưới 200.000đ", () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm A")); // 50,000đ
    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    expect(
      screen.getByText(/mua thêm.*để được miễn phí giao hàng/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("free-shipping-bar")).toBeInTheDocument();
  });

  it("hiển thị thông báo đạt điều kiện Freeship khi tổng tiền từ 200.000đ trở lên", () => {
    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );

    // Thêm 4 lần A (stock = 3) -> Thêm 3 lần A (150,000) + 2 lần B (80,000) = 230,000đ
    fireEvent.click(screen.getByText("Thêm A"));
    fireEvent.click(screen.getByText("Thêm A"));
    fireEvent.click(screen.getByText("Thêm A"));
    fireEvent.click(screen.getByText("Thêm B"));
    fireEvent.click(screen.getByText("Thêm B"));
    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    expect(
      screen.getByText(/bạn đã được miễn phí giao hàng/i),
    ).toBeInTheDocument();
  });

  it("nhập mã giảm giá trong giỏ gọi API validate và lưu mã cho trang thanh toán", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          ok: true,
          code: "GIAM10",
          type: "percent",
          value: 10,
          maxDiscount: 30_000,
          minOrderTotal: 0,
          discount: 5_000,
          shippingDiscount: 0,
          message: "ok",
        },
      }),
    } as Response);

    render(
      <OnlineCartProvider>
        <TestContainer />
      </OnlineCartProvider>,
    );
    fireEvent.click(screen.getByText("Thêm A"));
    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    fireEvent.change(screen.getByLabelText(/mã ưu đãi/i), {
      target: { value: "giam10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));

    expect(
      await screen.findByTestId("cart-voucher-discount"),
    ).toHaveTextContent("5.000");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/online/vouchers/validate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(localStorage.getItem("online-voucher-v1")).toBe("GIAM10");
    fetchSpy.mockRestore();
  });
});

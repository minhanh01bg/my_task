import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  OnlineCartProvider,
  useOnlineCart,
} from "@/features/online-store/cart-context";
import { CartDrawer } from "@/features/online-store/cart-drawer";
import type { OnlineProduct } from "@/features/online-store/types";

const STORAGE_KEY = "online-cart-v1";

// Tồn kho bán theo cân/lít có thể lẻ; đơn online chỉ nhận số nguyên.
const gao: OnlineProduct = {
  id: "gao",
  name: "Gạo ST25",
  price: 30_000,
  unit: "kg",
  stock: 2.5,
  imageUrl: null,
  categoryId: null,
  searchText: "gao st25",
};

function renderCart() {
  return renderHook(() => useOnlineCart(), { wrapper: OnlineCartProvider });
}

describe("giỏ online chỉ giữ số lượng nguyên", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("thêm vượt tồn kho lẻ thì dừng ở phần nguyên của tồn kho", () => {
    const { result } = renderCart();

    let added!: ReturnType<typeof result.current.add>;
    act(() => {
      added = result.current.add(gao, 5);
    });

    expect(result.current.lines[0]?.quantity).toBe(2);
    expect(added.quantity).toBe(2);

    act(() => {
      added = result.current.add(gao, 1);
    });
    expect(added).toMatchObject({ status: "capped", maxAvailable: 2 });
    expect(result.current.lines[0]?.quantity).toBe(2);
  });

  it("tồn kho dưới 1 đơn vị coi như hết hàng", () => {
    const { result } = renderCart();

    let added!: ReturnType<typeof result.current.add>;
    act(() => {
      added = result.current.add({ ...gao, stock: 0.5 });
    });

    expect(added.status).toBe("unavailable");
    expect(result.current.lines).toEqual([]);
  });

  it("đặt số lượng lẻ hoặc ngoài khoảng thì làm tròn xuống trong [1, tồn kho]", () => {
    const { result } = renderCart();
    act(() => {
      result.current.add(gao);
    });

    const quantityAfter = (value: number) => {
      act(() => result.current.setQuantity(gao.id, value));
      return result.current.lines[0]?.quantity;
    };

    expect(quantityAfter(1.5)).toBe(1);
    expect(quantityAfter(2.5)).toBe(2);
    expect(quantityAfter(99)).toBe(2);
    expect(quantityAfter(0)).toBe(1);
    expect(quantityAfter(Number.NaN)).toBe(1);
  });

  it("giỏ khôi phục từ localStorage được chuẩn hoá về số nguyên", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { ...gao, quantity: 2.5 },
        { ...gao, id: "tra", stock: 10, quantity: 0.3 },
        { ...gao, id: "het", stock: 0.4, quantity: 0.4 },
        { ...gao, id: "hong", stock: "9", quantity: 1 },
        null,
      ]),
    );

    const { result } = renderCart();

    expect(
      result.current.lines.map((line) => [line.id, line.quantity]),
    ).toEqual([
      ["gao", 2],
      ["tra", 1],
    ]);
  });

  it("dữ liệu localStorage không phải mảng thì bắt đầu giỏ rỗng", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ gao: 3 }));

    const { result } = renderCart();

    expect(result.current.lines).toEqual([]);
  });

  describe("trần 50 mỗi dòng như server", () => {
    const nuoc: OnlineProduct = { ...gao, id: "nuoc", stock: 500 };

    it("thêm nhiều lần không vượt 50, báo đúng lý do", () => {
      const { result } = renderCart();

      let added!: ReturnType<typeof result.current.add>;
      act(() => {
        added = result.current.add(nuoc, 60);
      });
      expect(result.current.lines[0]?.quantity).toBe(50);
      expect(added.quantity).toBe(50);

      act(() => {
        added = result.current.add(nuoc, 1);
      });
      expect(added).toMatchObject({
        status: "capped",
        quantity: 50,
        maxAvailable: 50,
        message: "Mỗi sản phẩm chỉ được đặt tối đa 50 trong một đơn",
      });
      expect(result.current.lines[0]?.quantity).toBe(50);
    });

    it("đặt số lượng lớn thì dừng ở 50", () => {
      const { result } = renderCart();
      act(() => {
        result.current.add(nuoc);
      });
      act(() => result.current.setQuantity(nuoc.id, 99));
      expect(result.current.lines[0]?.quantity).toBe(50);
    });

    it("giỏ cũ trong localStorage vượt 50 được hạ về 50", () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([{ ...nuoc, quantity: 120 }]),
      );
      const { result } = renderCart();
      expect(result.current.lines[0]?.quantity).toBe(50);
    });
  });

  it("nút tăng trong giỏ bị khoá khi đạt phần nguyên của tồn kho", () => {
    function Harness() {
      const { add, openDrawer } = useOnlineCart();
      return (
        <>
          <button onClick={() => add(gao, 2)}>Thêm</button>
          <button onClick={openDrawer}>Mở giỏ hàng</button>
          <CartDrawer shipping={{ shippingFee: 0, freeShippingThreshold: 0 }} />
        </>
      );
    }
    render(
      <OnlineCartProvider>
        <Harness />
      </OnlineCartProvider>,
    );

    fireEvent.click(screen.getByText("Thêm"));
    fireEvent.click(screen.getByText("Mở giỏ hàng"));

    expect(screen.getByTestId("quantity-gao")).toHaveTextContent("2");
    expect(
      screen.getByRole("button", { name: /tăng số lượng gạo st25/i }),
    ).toBeDisabled();
  });
});

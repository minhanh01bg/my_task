import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OnlineCartProvider,
  useOnlineCart,
} from "@/features/online-store/cart-context";
import { StoreHeader } from "@/features/online-store/store-header";

const PRODUCTS = [
  {
    id: "p1",
    name: "Gạo ST25",
    slug: "gao-st25",
    price: 30_000,
    unit: "kg",
    stock: 5,
    imageUrl: null,
    categoryId: null,
    searchText: "gao st25",
  },
  {
    id: "p2",
    name: "Nước mắm",
    slug: null,
    price: 40_000,
    unit: "chai",
    stock: 0,
    imageUrl: null,
    categoryId: null,
    searchText: "nuoc mam",
  },
];

function CartCount() {
  const { lines } = useOnlineCart();
  return <output data-testid="cart-lines">{lines.length}</output>;
}

function renderHeader() {
  return render(
    <OnlineCartProvider>
      <StoreHeader storeName="Tiệm" />
      <CartCount />
    </OnlineCartProvider>,
  );
}

function mockFetch() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.startsWith("/api/online/wishlist")) {
      return {
        ok: true,
        json: async () => ({ data: { products: PRODUCTS } }),
      } as Response;
    }
    // Phien storefront cua header.
    return {
      ok: true,
      json: async () => ({ isAdmin: false, isCustomer: false }),
    } as Response;
  });
}

describe("WishlistDrawer", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("nút trái tim mở ngăn yêu thích (không còn link ?wishlist=true)", async () => {
    const user = userEvent.setup();
    localStorage.setItem("online-wishlist-v1", JSON.stringify(["p2", "p1"]));
    const fetchSpy = mockFetch();
    renderHeader();

    const trigger = screen.getByRole("button", {
      name: "Danh sách yêu thích (2 sản phẩm)",
    });
    expect(trigger.tagName).toBe("BUTTON");
    await user.click(trigger);

    const dialog = await screen.findByRole("dialog", {
      name: "Sản phẩm yêu thích",
    });
    // Giu thu tu danh sach yeu thich.
    const names = await within(dialog).findAllByRole("link");
    expect(names.map((link) => link.textContent)).toEqual([
      "Nước mắm",
      "Gạo ST25",
    ]);
    expect(names[1]).toHaveAttribute("href", "/shop/p/gao-st25");
    expect(
      fetchSpy.mock.calls.some(([url]) =>
        String(url).startsWith("/api/online/wishlist?ids=p2%2Cp1"),
      ),
    ).toBe(true);
    expect(
      within(dialog).getByRole("button", { name: "Nước mắm đã hết hàng" }),
    ).toBeDisabled();
  });

  it("thêm vào giỏ và bỏ khỏi danh sách yêu thích", async () => {
    const user = userEvent.setup();
    localStorage.setItem("online-wishlist-v1", JSON.stringify(["p1"]));
    mockFetch();
    renderHeader();

    await user.click(
      screen.getByRole("button", { name: /danh sách yêu thích/i }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Sản phẩm yêu thích",
    });

    await user.click(
      await within(dialog).findByRole("button", {
        name: "Thêm Gạo ST25 vào giỏ",
      }),
    );
    expect(screen.getByTestId("cart-lines")).toHaveTextContent("1");

    await user.click(
      within(dialog).getByRole("button", {
        name: "Bỏ Gạo ST25 khỏi danh sách yêu thích",
      }),
    );
    await waitFor(() =>
      expect(
        within(dialog).getByText("Chưa có sản phẩm yêu thích"),
      ).toBeInTheDocument(),
    );
    expect(localStorage.getItem("online-wishlist-v1")).toBe("[]");
  });

  it("danh sách rỗng hiện trạng thái trống, không gọi API", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockFetch();
    renderHeader();

    await user.click(
      screen.getByRole("button", { name: /danh sách yêu thích/i }),
    );
    expect(
      await screen.findByText("Chưa có sản phẩm yêu thích"),
    ).toBeInTheDocument();
    expect(
      fetchSpy.mock.calls.some(([url]) =>
        String(url).startsWith("/api/online/wishlist"),
      ),
    ).toBe(false);
  });
});

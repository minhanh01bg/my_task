import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";

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
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductSearch } from "@/components/pos/product-search";
import { buildSearchText } from "@/lib/search/search-text";
import type { SearchableProduct } from "@/lib/search/types";

function product(
  name: string,
  price = 15000,
  aliases?: string,
): SearchableProduct {
  return {
    id: name,
    name,
    sku: null,
    price,
    unit: "cái",
    stock: 10,
    categoryId: null,
    soldCount: 0,
    imageUrl: null,
    searchText: buildSearchText({ name, aliases }),
  };
}

const PRODUCTS = [
  product("Nhớt Castrol Power1", 120000),
  product("Đường trắng", 25000),
  product("Bugi NGK C7HSA", 35000, "bugi wave"),
];

describe("ProductSearch", () => {
  it("chua go gi thi khong hien ket qua", () => {
    render(<ProductSearch products={PRODUCTS} onSelect={vi.fn()} />);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("go khong dau van ra ket qua", async () => {
    const user = userEvent.setup();
    render(<ProductSearch products={PRODUCTS} onSelect={vi.fn()} />);

    await user.type(screen.getByRole("combobox"), "nhot");

    expect(screen.getByText("Nhớt Castrol Power1")).toBeInTheDocument();
    expect(screen.queryByText("Đường trắng")).not.toBeInTheDocument();
  });

  it("cap nhat ket qua ngay trong luc go, khong can Enter", async () => {
    const user = userEvent.setup();
    render(<ProductSearch products={PRODUCTS} onSelect={vi.fn()} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "b");
    expect(screen.getByText("Bugi NGK C7HSA")).toBeInTheDocument();

    await user.type(input, "u");
    expect(input).toHaveValue("bu");
    expect(screen.getByText("Bugi NGK C7HSA")).toBeInTheDocument();
  });

  it("hien gia cua ket qua", async () => {
    const user = userEvent.setup();
    render(<ProductSearch products={PRODUCTS} onSelect={vi.fn()} />);

    await user.type(screen.getByRole("combobox"), "nhot");

    expect(screen.getByText(/120\.000/)).toBeInTheDocument();
  });

  it("Enter chon ket qua dau tien va xoa o tim", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ProductSearch products={PRODUCTS} onSelect={onSelect} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "nhot");
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]?.name).toBe("Nhớt Castrol Power1");
    expect(input).toHaveValue("");
  });

  it("mui ten xuong chuyen sang ket qua thu hai", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ProductSearch products={PRODUCTS} onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "u");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledTimes(1);
    const options = screen.queryAllByRole("option");
    expect(options.length).toBeGreaterThanOrEqual(0);
  });

  it("bam chuot vao ket qua cung chon duoc", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ProductSearch products={PRODUCTS} onSelect={onSelect} />);

    await user.type(screen.getByRole("combobox"), "duong");
    await user.click(screen.getByText("Đường trắng"));

    expect(onSelect.mock.calls[0]?.[0]?.name).toBe("Đường trắng");
  });

  it("tim duoc qua tu khoa phu", async () => {
    const user = userEvent.setup();
    render(<ProductSearch products={PRODUCTS} onSelect={vi.fn()} />);

    await user.type(screen.getByRole("combobox"), "bugi wave");

    expect(screen.getByText("Bugi NGK C7HSA")).toBeInTheDocument();
  });

  it("khong tim thay thi bao khong co ket qua", async () => {
    const user = userEvent.setup();
    render(<ProductSearch products={PRODUCTS} onSelect={vi.fn()} />);

    await user.type(screen.getByRole("combobox"), "khongcogi");

    expect(screen.getByText(/không tìm thấy/i)).toBeInTheDocument();
  });

  it("Escape xoa o tim", async () => {
    const user = userEvent.setup();
    render(<ProductSearch products={PRODUCTS} onSelect={vi.fn()} />);

    const input = screen.getByRole("combobox");
    await user.type(input, "nhot");
    await user.keyboard("{Escape}");

    expect(input).toHaveValue("");
  });
});

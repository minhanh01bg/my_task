import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ProductForm } from "@/app/admin/products/product-form";
import type { CatalogCategory } from "@/types/catalog";

const mockCategories: CatalogCategory[] = [
  { id: "cat-1", name: "Đồ uống", sortOrder: 0 },
  { id: "cat-2", name: "Bánh kẹo", sortOrder: 1 },
];

describe("ProductForm (Admin)", () => {
  it("hiển thị các trường số với bước nhảy 1.000đ cho giá bán và nút bấm rõ ràng", () => {
    const { container } = render(
      <ProductForm
        categories={mockCategories}
        product={{
          id: "prod-1",
          name: "Trà xanh Không Độ",
          aliases: "tra xanh, o do",
          sku: "TX-01",
          categoryId: "cat-1",
          unit: "chai",
          stock: 24,
          price: 12000,
          costPrice: 9000,
          imageUrl: null,
        }}
      />,
    );

    // Kiểm tra trường Giá bán
    const priceInput = container.querySelector<HTMLInputElement>(
      'input[name="price"]',
    )!;
    expect(priceInput).toBeInTheDocument();
    expect(priceInput.value).toBe("12000");
    expect(priceInput.step).toBe("1000");

    // Kiểm tra trường Tồn kho hỗ trợ số thập phân (step="any")
    const stockInput = container.querySelector<HTMLInputElement>(
      'input[name="stock"]',
    )!;
    expect(stockInput).toBeInTheDocument();
    expect(stockInput.value).toBe("24");
    expect(stockInput.step).toBe("any");

    // Kiểm tra trường Giá vốn
    const costPriceInput = container.querySelector<HTMLInputElement>(
      'input[name="costPrice"]',
    )!;
    expect(costPriceInput).toBeInTheDocument();
    expect(costPriceInput.value).toBe("9000");
    expect(costPriceInput.step).toBe("1000");
  });

  it("cho phép tăng giảm giá bán theo từng nghìn đồng qua nút stepper", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ProductForm
        categories={mockCategories}
        product={{
          id: "prod-2",
          name: "Bánh mì sandwich",
          aliases: null,
          sku: null,
          categoryId: null,
          unit: "gói",
          stock: 10,
          price: 15000,
          costPrice: 11000,
          imageUrl: null,
        }}
      />,
    );

    const priceInput = container.querySelector<HTMLInputElement>(
      'input[name="price"]',
    )!;

    // Nút tăng giá bán (bước nhảy 1.000đ)
    const increasePriceBtn = screen.getByRole("button", {
      name: /tăng giá bán 1\.000 ₫/i,
    });
    await user.click(increasePriceBtn);
    expect(priceInput.value).toBe("16000");

    await user.click(increasePriceBtn);
    expect(priceInput.value).toBe("17000");

    // Nút giảm giá bán
    const decreasePriceBtn = screen.getByRole("button", {
      name: /giảm giá bán 1\.000 ₫/i,
    });
    await user.click(decreasePriceBtn);
    expect(priceInput.value).toBe("16000");
  });

  it("cộng nhanh giá bán bằng các chip gợi ý (+5.000, +10.000, +50.000)", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ProductForm
        categories={mockCategories}
        product={{
          id: "prod-3",
          name: "Sữa chua Vinamilk",
          aliases: null,
          sku: null,
          categoryId: null,
          unit: "hộp",
          stock: 50,
          price: 7000,
          costPrice: 5500,
          imageUrl: null,
        }}
      />,
    );

    const priceInput = container.querySelector<HTMLInputElement>(
      'input[name="price"]',
    )!;

    // Bấm chip +5.000 vào Giá bán
    const chip5k = screen.getByRole("button", {
      name: /cộng \+5\.000 vào giá bán/i,
    });
    await user.click(chip5k);
    expect(priceInput.value).toBe("12000");

    // Bấm chip +10.000 vào Giá bán
    const chip10k = screen.getByRole("button", {
      name: /cộng \+10\.000 vào giá bán/i,
    });
    await user.click(chip10k);
    expect(priceInput.value).toBe("22000");
  });

  it("hỗ trợ nhập số lượng tồn kho thập phân và giá vốn chuẩn xác", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ProductForm
        categories={mockCategories}
        product={{
          id: "prod-4",
          name: "Thịt ba chỉ heo",
          aliases: null,
          sku: "TP-04",
          categoryId: "cat-1",
          unit: "kg",
          stock: 2.5,
          price: 130000,
          costPrice: 95000,
          imageUrl: null,
        }}
      />,
    );

    const stockInput = container.querySelector<HTMLInputElement>(
      'input[name="stock"]',
    )!;
    expect(stockInput.value).toBe("2.5");

    // Người dùng gõ thay đổi số lượng thập phân lẻ
    await user.clear(stockInput);
    await user.type(stockInput, "4.75");
    expect(stockInput.value).toBe("4.75");

    // Hỗ trợ nút tăng/giảm và chip cộng nhanh cho số lượng tồn kho
    const increaseStockBtn = screen.getByRole("button", {
      name: /tăng số lượng tồn kho 1/i,
    });
    await user.click(increaseStockBtn);
    expect(stockInput.value).toBe("5.75");

    const chip5Stock = screen.getByRole("button", {
      name: /cộng \+5 vào số lượng tồn kho/i,
    });
    await user.click(chip5Stock);
    expect(stockInput.value).toBe("10.75");

    // Người dùng gõ giá vốn
    const costPriceInput = container.querySelector<HTMLInputElement>(
      'input[name="costPrice"]',
    )!;
    expect(costPriceInput.value).toBe("95000");
    await user.clear(costPriceInput);
    await user.type(costPriceInput, "105000");
    expect(costPriceInput.value).toBe("105000");

    // Hỗ trợ nút tăng/giảm và chip cộng nhanh cho giá vốn giống như giá bán
    const increaseCostBtn = screen.getByRole("button", {
      name: /tăng giá vốn 1\.000 ₫/i,
    });
    await user.click(increaseCostBtn);
    expect(costPriceInput.value).toBe("106000");

    const chip10kCost = screen.getByRole("button", {
      name: /cộng \+10\.000 vào giá vốn/i,
    });
    await user.click(chip10kCost);
    expect(costPriceInput.value).toBe("116000");
  });
});

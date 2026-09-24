import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { QuickProductEdit } from "@/app/admin/products/quick-product-edit";

describe("QuickProductEdit (Admin)", () => {
  it("hỗ trợ sửa nhanh sản phẩm có giá lẻ (7.500) và tồn kho số thập phân (1.25)", async () => {
    const user = userEvent.setup();

    render(
      <QuickProductEdit
        product={{
          id: "prod-1",
          name: "Đường trắng",
          price: 7500,
          stock: 1.25,
          unit: "kg",
        }}
      />,
    );

    // Mở dialog sửa nhanh
    const openBtn = screen.getByRole("button", {
      name: /sửa nhanh giá và tồn kho của đường trắng/i,
    });
    await user.click(openBtn);

    const priceInput = screen.getByLabelText("Giá bán") as HTMLInputElement;
    const stockInput = screen.getByLabelText("Tồn kho kg") as HTMLInputElement;

    expect(priceInput).toBeInTheDocument();
    expect(priceInput.value).toBe("7500");
    // Không bị lỗi stepMismatch với giá lẻ 7.500
    expect(priceInput.validity.stepMismatch).toBe(false);

    expect(stockInput).toBeInTheDocument();
    expect(stockInput.value).toBe("1.25");
    // Hỗ trợ số thập phân, không bị lỗi stepMismatch
    expect(stockInput.validity.stepMismatch).toBe(false);
  });

  it("hỗ trợ sửa nhanh sản phẩm có tồn kho âm từ bán hàng POS", async () => {
    const user = userEvent.setup();

    render(
      <QuickProductEdit
        product={{
          id: "prod-2",
          name: "Bia Tiger lon",
          price: 18000,
          stock: -3,
          unit: "lon",
        }}
      />,
    );

    const openBtn = screen.getByRole("button", {
      name: /sửa nhanh giá và tồn kho của bia tiger lon/i,
    });
    await user.click(openBtn);

    const stockInput = screen.getByLabelText("Tồn kho lon") as HTMLInputElement;
    expect(stockInput).toBeInTheDocument();
    expect(stockInput.value).toBe("-3");
    // Không bị lỗi underflow hay chặn số âm
    expect(stockInput.validity.rangeUnderflow).toBe(false);
  });
});

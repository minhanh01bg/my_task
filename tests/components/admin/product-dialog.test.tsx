import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductDialog } from "@/app/admin/products/product-dialog";
import type { CatalogCategory } from "@/types/catalog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const mockCategories: CatalogCategory[] = [
  { id: "cat-1", name: "Đồ uống", sortOrder: 0 },
  { id: "cat-2", name: "Gia vị", sortOrder: 1 },
];

describe("ProductDialog (Admin)", () => {
  it("hiển thị nút kích hoạt mặc định và mở dialog rộng rãi (sm:max-w-3xl lg:max-w-4xl)", async () => {
    const user = userEvent.setup();

    render(<ProductDialog categories={mockCategories} />);

    // Kiểm tra nút kích hoạt mặc định
    const triggerBtn = screen.getByRole("button", { name: /thêm sản phẩm/i });
    expect(triggerBtn).toBeInTheDocument();

    // Nhấn mở dialog
    await user.click(triggerBtn);

    // Kiểm tra tiêu đề modal
    expect(
      screen.getByRole("heading", { name: "Thêm sản phẩm mới" }),
    ).toBeInTheDocument();

    // Kiểm tra class sizing của dialog content có responsive override rộng rãi
    const dialogContent = screen.getByRole("dialog");
    expect(dialogContent.className).toContain("sm:max-w-3xl");
    expect(dialogContent.className).toContain("lg:max-w-4xl");
  });

  it("mở sẵn dialog khi có defaultOpen và hiển thị thông tin sản phẩm cần sửa", () => {
    render(
      <ProductDialog
        categories={mockCategories}
        defaultOpen={true}
        product={{
          id: "prod-100",
          name: "Nước tương Tam Thái Tử",
          aliases: "tam thai tu",
          sku: "TTT-500",
          categoryId: "cat-2",
          unit: "chai",
          stock: 30,
          price: 18000,
          costPrice: 14000,
          imageUrl: null,
        }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Sửa sản phẩm: Nước tương Tam Thái Tử",
      }),
    ).toBeInTheDocument();

    const dialogContent = screen.getByRole("dialog");
    expect(dialogContent.className).toContain("sm:max-w-3xl");
    expect(dialogContent.className).toContain("lg:max-w-4xl");
  });
});

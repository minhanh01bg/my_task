import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { ProductDetailView } from "@/features/online-store/product-detail-view";
import type { OnlineProductDetail } from "@/server/catalog/get-product-detail";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const mockDetail: OnlineProductDetail = {
  product: {
    id: "prod-detail-01",
    name: "Sữa Chua Uống Men Sống",
    sku: "SC-001",
    price: 32_000,
    unit: "lốc",
    stock: 8,
    imageUrl: "/images/yogurt.jpg",
    categoryId: "cat-drinks",
    searchText: "sua chua uong men song",
    soldCount: 42,
    ratingAvg: 4.5,
    ratingCount: 2,
    category: {
      id: "cat-drinks",
      name: "Sữa & Sữa Chua",
    },
  },
  relatedProducts: [
    {
      id: "prod-rel-02",
      name: "Sữa Tươi Tiệt Trùng",
      price: 36_000,
      unit: "lốc",
      stock: 12,
      imageUrl: null,
      categoryId: "cat-drinks",
      searchText: "sua tuoi tiet trung",
      soldCount: 15,
    },
  ],
  reviews: {
    items: [
      {
        id: "rev-01",
        authorName: "Lan Anh",
        rating: 5,
        content: "Sữa chua ngon, date mới",
        isVerifiedPurchase: true,
        createdAt: "2026-09-20T03:00:00.000Z",
      },
    ],
    total: 2,
    page: 1,
    pageSize: 10,
  },
};

const mockOutOfStockDetail: OnlineProductDetail = {
  product: {
    id: "prod-oos-01",
    name: "Trà Đào Hết Hàng",
    sku: "TD-002",
    price: 25_000,
    unit: "chai",
    stock: 0,
    imageUrl: null,
    categoryId: null,
    searchText: "tra dao het hang",
    soldCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
    category: null,
  },
  relatedProducts: [],
  reviews: { items: [], total: 0, page: 1, pageSize: 10 },
};

describe("ProductDetailView", () => {
  it("hiển thị đầy đủ thông tin sản phẩm, mã SKU, danh mục và giá tiền", () => {
    render(
      <OnlineCartProvider>
        <ProductDetailView detail={mockDetail} />
      </OnlineCartProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Sữa Chua Uống Men Sống" }),
    ).toBeInTheDocument();
    expect(screen.getByText("32.000 ₫")).toBeInTheDocument();
    expect(screen.getAllByText("/lốc").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Mã SP:")).toBeInTheDocument();
    expect(screen.getByText("SC-001")).toBeInTheDocument();
    expect(screen.getAllByText("Sữa & Sữa Chua").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Sản phẩm cùng danh mục")).toBeInTheDocument();
    expect(screen.getByText("Sữa Tươi Tiệt Trùng")).toBeInTheDocument();
  });

  it("hiển thị điểm đánh giá thật và danh sách đánh giá từ server", () => {
    render(
      <OnlineCartProvider>
        <ProductDetailView detail={mockDetail} />
      </OnlineCartProvider>,
    );

    expect(
      screen.getByRole("link", { name: "Xem 2 đánh giá" }),
    ).toHaveAttribute("href", "#product-reviews");
    expect(screen.getAllByText("(2 đánh giá)").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Sữa chua ngon, date mới")).toBeInTheDocument();
    expect(screen.queryByText(/28 đánh giá/)).not.toBeInTheDocument();
  });

  it("ẩn sao khi sản phẩm chưa có đánh giá", () => {
    render(
      <OnlineCartProvider>
        <ProductDetailView detail={mockOutOfStockDetail} />
      </OnlineCartProvider>,
    );

    expect(screen.queryByLabelText(/trên 5 sao/)).not.toBeInTheDocument();
    expect(screen.getByText("Chưa có đánh giá")).toBeInTheDocument();
  });

  it("cho phép tăng giảm số lượng hợp lệ và thêm vào giỏ hàng", async () => {
    const user = userEvent.setup();
    render(
      <OnlineCartProvider>
        <ProductDetailView detail={mockDetail} />
      </OnlineCartProvider>,
    );

    const stepper = screen.getByLabelText("Số lượng") as HTMLInputElement;
    expect(stepper.value).toBe("1");

    const plusBtn = screen.getByRole("button", { name: "Tăng số lượng" });
    const minusBtn = screen.getByRole("button", { name: "Giảm số lượng" });

    // Click plus
    await user.click(plusBtn);
    expect(stepper.value).toBe("2");

    // Click minus
    await user.click(minusBtn);
    expect(stepper.value).toBe("1");

    // Click "Thêm vào giỏ hàng"
    const addBtn = screen.getByRole("button", { name: "Thêm vào giỏ hàng" });
    await user.click(addBtn);

    // Toast status feedback
    expect(screen.getByRole("status")).toHaveTextContent(
      "Sữa Chua Uống Men Sống",
    );
  });

  it("vô hiệu hóa nút thêm giỏ và hiển thị huy hiệu khi hết hàng", () => {
    render(
      <OnlineCartProvider>
        <ProductDetailView detail={mockOutOfStockDetail} />
      </OnlineCartProvider>,
    );

    expect(screen.getAllByText("Tạm hết hàng").length).toBeGreaterThanOrEqual(
      1,
    );
    const addBtn = screen.getByRole("button", { name: "Tạm hết hàng" });
    expect(addBtn).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Mua ngay" }),
    ).not.toBeInTheDocument();
  });

  it("bấm Mua ngay chuyển hướng người dùng đến /checkout", async () => {
    const user = userEvent.setup();
    render(
      <OnlineCartProvider>
        <ProductDetailView detail={mockDetail} />
      </OnlineCartProvider>,
    );

    const buyNowBtn = screen.getByRole("button", { name: "Mua ngay" });
    await user.click(buyNowBtn);
    expect(push).toHaveBeenCalledWith("/checkout");
  });
});

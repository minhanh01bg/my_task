import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategorySection } from "@/features/online-store/landing/category-section";
import { HeroSection } from "@/features/online-store/landing/hero-section";
import { ProductRail } from "@/features/online-store/landing/product-rail";
import { TrustSection } from "@/features/online-store/landing/trust-section";
import type {
  OnlineCategory,
  OnlineProduct,
} from "@/features/online-store/types";

const mockCategories: OnlineCategory[] = [
  { id: "c1", name: "Đồ uống & Cà phê" },
  { id: "c2", name: "Bánh kẹo & Snack" },
];

const mockProducts: OnlineProduct[] = [
  {
    id: "p1",
    name: "Cà phê Đậm Đà",
    price: 65_000,
    unit: "gói",
    stock: 15,
    imageUrl: "/images/coffee.jpg",
    categoryId: "c1",
    searchText: "ca phe dam da",
  },
  {
    id: "p2",
    name: "Trà Oolong Thượng Hạng",
    price: 85_000,
    unit: "hộp",
    stock: 5,
    imageUrl: null,
    categoryId: "c1",
    searchText: "tra oolong thuong hang",
  },
];

describe("Storefront Landing Page Components", () => {
  describe("HeroSection", () => {
    it("có đúng một thẻ H1 và CTA liên kết tới #catalog", () => {
      render(
        <HeroSection
          storeName="Tạp Hóa Xanh"
          tagline="Hàng thiết yếu, đặt nhanh tại nhà"
        />,
      );

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading.textContent).toContain(
        "Hàng thiết yếu, đặt nhanh tại nhà",
      );

      const cta = screen.getByRole("link", { name: /mua ngay|khám phá/i });
      expect(cta).toHaveAttribute("href", "#catalog");
    });
  });

  describe("CategorySection", () => {
    it("hiển thị danh sách danh mục nổi bật kèm liên kết lọc", () => {
      render(<CategorySection categories={mockCategories} />);

      expect(screen.getByText("Đồ uống & Cà phê")).toBeInTheDocument();
      expect(screen.getByText("Bánh kẹo & Snack")).toBeInTheDocument();

      const link = screen.getByRole("link", { name: /đồ uống & cà phê/i });
      expect(link).toHaveAttribute(
        "href",
        expect.stringContaining("category=c1"),
      );
    });

    it("hiển thị fallback có ích khi chưa có danh mục", () => {
      render(<CategorySection categories={[]} />);

      expect(
        screen.getByText(/đang cập nhật danh mục|khám phá toàn bộ/i),
      ).toBeInTheDocument();
    });
  });

  describe("ProductRail", () => {
    it("hiển thị sản phẩm nổi bật với giá và tên", () => {
      render(<ProductRail title="Sản phẩm nổi bật" products={mockProducts} />);

      expect(screen.getByText("Sản phẩm nổi bật")).toBeInTheDocument();
      expect(screen.getByText("Cà phê Đậm Đà")).toBeInTheDocument();
      expect(screen.getByText("65.000 ₫")).toBeInTheDocument();
      expect(screen.getByText("Trà Oolong Thượng Hạng")).toBeInTheDocument();
    });

    it("hiển thị fallback trung thực khi danh sách sản phẩm rỗng", () => {
      render(<ProductRail title="Sản phẩm nổi bật" products={[]} />);

      expect(
        screen.getByText(
          /chưa có sản phẩm nổi bật|sản phẩm sẽ sớm được cập nhật/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("TrustSection", () => {
    it("hiển thị các cam kết dịch vụ và hỗ trợ cửa hàng", () => {
      render(<TrustSection storeName="Tạp Hóa Xanh" hotline="0901234567" />);

      expect(screen.getByText(/cam kết chất lượng/i)).toBeInTheDocument();
      expect(screen.getByText(/giá niêm yết rõ ràng/i)).toBeInTheDocument();
      expect(screen.getByText(/hỗ trợ trực tiếp/i)).toBeInTheDocument();
    });
  });
});

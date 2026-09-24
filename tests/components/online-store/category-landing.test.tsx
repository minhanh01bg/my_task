import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CategoryLanding } from "@/features/online-store/category-landing";
import type { OnlineProduct } from "@/features/online-store/types";
import { categoryCrumbs } from "@/lib/seo/breadcrumbs";
import type { CategoryProductsPage } from "@/server/catalog/list-category-products";

const category = { id: "c1", name: "Nước chấm", slug: "nuoc-cham" };

function product(i: number, slug: string | null): OnlineProduct {
  return {
    id: `p${i}`,
    name: `Nước mắm ${i}`,
    slug,
    price: 45_000,
    unit: "chai",
    stock: 3,
    imageUrl: null,
    categoryId: "c1",
    searchText: `nuoc mam ${i}`,
  };
}

function renderLanding(data: CategoryProductsPage) {
  return render(
    <OnlineCartProvider>
      <CategoryLanding
        data={data}
        crumbs={categoryCrumbs(category)}
        description="Mô tả danh mục"
      />
    </OnlineCartProvider>,
  );
}

describe("CategoryLanding", () => {
  it("hiện tiêu đề, breadcrumb Cửa hàng → Danh mục và link sản phẩm theo slug", () => {
    renderLanding({
      category,
      products: [product(1, "nuoc-mam-1"), product(2, null)],
      total: 2,
      page: 1,
      pageSize: 24,
    });

    expect(
      screen.getByRole("heading", { level: 1, name: "Nước chấm" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mô tả danh mục")).toBeInTheDocument();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Cửa hàng");
    expect(breadcrumb).not.toHaveTextContent("Trang chủ");

    expect(screen.getByRole("link", { name: "Nước mắm 1" })).toHaveAttribute(
      "href",
      "/shop/p/nuoc-mam-1",
    );
    expect(screen.getByRole("link", { name: "Nước mắm 2" })).toHaveAttribute(
      "href",
      "/shop/products/p2",
    );
    // Một trang: không có phân trang.
    expect(
      screen.queryByRole("navigation", { name: /phân trang/i }),
    ).not.toBeInTheDocument();
  });

  it("phân trang bằng link ?page=N trên URL danh mục", () => {
    renderLanding({
      category,
      products: [product(25, "nuoc-mam-25")],
      total: 49,
      page: 2,
      pageSize: 24,
    });

    const nav = screen.getByRole("navigation", {
      name: "Phân trang danh mục Nước chấm",
    });
    expect(nav).toHaveTextContent("Trang 2/3");
    expect(screen.getByRole("link", { name: "Trang trước" })).toHaveAttribute(
      "href",
      "/shop/c/nuoc-cham?page=1",
    );
    expect(screen.getByRole("link", { name: "Trang sau" })).toHaveAttribute(
      "href",
      "/shop/c/nuoc-cham?page=3",
    );
  });

  it("empty state khi danh mục chưa có sản phẩm", () => {
    renderLanding({ category, products: [], total: 0, page: 1, pageSize: 24 });
    expect(screen.getByText("Danh mục chưa có sản phẩm")).toBeInTheDocument();
  });
});

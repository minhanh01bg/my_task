import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CategoryPillSkeleton,
  ProductCardSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/kit/skeleton-loader";

describe("Skeleton Loader Components", () => {
  it("render component Skeleton cơ bản với class animate-shimmer", () => {
    render(<Skeleton className="h-6 w-32" data-testid="basic-skel" />);
    const el = screen.getByTestId("basic-skel");
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("animate-shimmer");
    expect(el.className).toContain("h-6");
    expect(el.className).toContain("w-32");
  });

  it("render ProductCardSkeleton đầy đủ cấu trúc khung ảnh, tên, giá và nút", () => {
    render(<ProductCardSkeleton data-testid="product-skel" />);
    const card = screen.getByTestId("product-skel");
    expect(card).toBeInTheDocument();
    // Phải có ít nhất 4 skeleton con bên trong mô phỏng các phần tử card
    const shimmers = card.querySelectorAll(".animate-shimmer");
    expect(shimmers.length).toBeGreaterThanOrEqual(4);
  });

  it("render CategoryPillSkeleton với kích thước pill bo tròn", () => {
    render(<CategoryPillSkeleton data-testid="cat-skel" />);
    const pill = screen.getByTestId("cat-skel");
    expect(pill.className).toContain("rounded-full");
    expect(pill.className).toContain("animate-shimmer");
  });

  it("render TableSkeleton với số lượng hàng theo props rows", () => {
    render(<TableSkeleton rows={5} data-testid="table-skel" />);
    const table = screen.getByTestId("table-skel");
    const rowElements = table.querySelectorAll("[data-row-skeleton]");
    expect(rowElements.length).toBe(5);
  });
});

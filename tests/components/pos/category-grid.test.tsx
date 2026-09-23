import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategoryGrid } from "@/components/pos/category-grid";

const CATEGORIES = [
  { id: "c1", name: "Phụ tùng", sortOrder: 0 },
  { id: "c2", name: "Tạp hoá", sortOrder: 1 },
];

describe("CategoryGrid", () => {
  it("nut danh muc bao trang thai bang aria-pressed", async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(
      <CategoryGrid
        categories={CATEGORIES}
        products={[]}
        activeCategoryId="c1"
        onCategoryChange={onCategoryChange}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Phụ tùng" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Tạp hoá" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await user.click(screen.getByRole("button", { name: "Tạp hoá" }));
    expect(onCategoryChange).toHaveBeenCalledWith("c2");
  });
});

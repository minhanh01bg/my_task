import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LowStockNavBadge } from "@/features/admin-navigation/low-stock-nav-badge";
import { countLowStock } from "@/server/products/low-stock";

vi.mock("@/server/products/low-stock", () => ({ countLowStock: vi.fn() }));

describe("LowStockNavBadge", () => {
  it("hiển thị số sản phẩm sắp hết hàng", async () => {
    vi.mocked(countLowStock).mockResolvedValue(4);
    render(await LowStockNavBadge());

    const badge = screen.getByText("4");
    expect(badge).toHaveAttribute("aria-label", "4 sản phẩm sắp hết hàng");
  });

  it("gộp số lớn thành 99+", async () => {
    vi.mocked(countLowStock).mockResolvedValue(250);
    render(await LowStockNavBadge());
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("không render gì khi không có hàng sắp hết", async () => {
    vi.mocked(countLowStock).mockResolvedValue(0);
    const element = await LowStockNavBadge();
    expect(element).toBeNull();
  });
});

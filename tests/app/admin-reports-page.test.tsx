import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ReportsPage from "@/app/admin/reports/page";
import * as dailyRevenueModule from "@/server/reports/daily-revenue";

describe("ReportsPage Server Component", () => {
  it("render thành công trang Báo cáo mà không truyền function qua client boundary", async () => {
    vi.spyOn(dailyRevenueModule, "getDailyRevenue").mockResolvedValue([
      { date: "2026-09-13", revenue: 1_500_000, orderCount: 5 },
      { date: "2026-09-14", revenue: 2_500_000, orderCount: 8 },
    ]);
    vi.spyOn(dailyRevenueModule, "getTopProducts").mockResolvedValue([
      { id: "p1", name: "Đường trắng", soldCount: 20 },
    ]);
    vi.spyOn(dailyRevenueModule, "getLowStockProducts").mockResolvedValue([
      { id: "p2", name: "Dây điện", stock: 2, unit: "cuộn" },
    ]);

    const jsx = await ReportsPage();
    render(jsx);

    expect(screen.getByText("Báo cáo")).toBeInTheDocument();
    expect(screen.getByText("Biểu đồ xu hướng doanh thu")).toBeInTheDocument();
    expect(screen.getByText("Đường trắng")).toBeInTheDocument();
    expect(screen.getByText("Dây điện")).toBeInTheDocument();
  });
});

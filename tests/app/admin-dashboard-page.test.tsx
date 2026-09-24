import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminDashboardPage from "@/app/admin/page";
import { DashboardSection } from "@/features/admin-dashboard/dashboard-section";
import {
  getDashboardSummary,
  type DashboardSummary,
} from "@/server/admin/dashboard";

vi.mock("@/server/admin/dashboard", () => ({
  getDashboardSummary: vi.fn(),
}));

const summary: DashboardSummary = {
  today: { revenue: 1_250_000, orderCount: 9 },
  awaitingOnlineCount: 3,
  lowStockCount: 7,
  week: [
    { date: "2026-09-18", revenue: 0, orderCount: 0 },
    { date: "2026-09-19", revenue: 200_000, orderCount: 2 },
    { date: "2026-09-20", revenue: 0, orderCount: 0 },
    { date: "2026-09-21", revenue: 300_000, orderCount: 3 },
    { date: "2026-09-22", revenue: 0, orderCount: 0 },
    { date: "2026-09-23", revenue: 450_000, orderCount: 4 },
    { date: "2026-09-24", revenue: 1_250_000, orderCount: 9 },
  ],
  latestOnlineOrders: [
    {
      id: "o1",
      code: "DH000123",
      total: 180_000,
      status: "pending",
      fulfillmentStatus: "new",
      contactName: "Chị Lan",
      createdAt: new Date("2026-09-24T03:15:00Z"),
    },
  ],
  lowStockProducts: [
    { id: "p1", name: "Dây điện", stock: -1, unit: "cuộn" },
    { id: "p2", name: "Ổ cắm", stock: 2, unit: "cái" },
  ],
};

const emptySummary: DashboardSummary = {
  today: { revenue: 0, orderCount: 0 },
  awaitingOnlineCount: 0,
  lowStockCount: 0,
  week: summary.week.map((point) => ({ ...point, revenue: 0, orderCount: 0 })),
  latestOnlineOrders: [],
  lowStockProducts: [],
};

describe("Trang tổng quan /admin", () => {
  beforeEach(() => {
    vi.mocked(getDashboardSummary).mockReset();
  });

  it("hien tieu de ngay va khung xuong trong luc cho so lieu", () => {
    vi.mocked(getDashboardSummary).mockReturnValue(new Promise(() => {}));

    render(<AdminDashboardPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Tổng quan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Đang tải số liệu tổng quan" }),
    ).toBeInTheDocument();
  });

  it("hien 4 o so lieu, bieu do 7 ngay va hai danh sach co link", async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(summary);

    render(await DashboardSection());

    expect(screen.getByText("Doanh thu hôm nay")).toBeInTheDocument();
    expect(screen.getByLabelText("1.250.000")).toBeInTheDocument();
    expect(screen.getByText("Đơn hôm nay")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("Đơn online chờ xử lý")).toBeInTheDocument();
    expect(screen.getByText("Sắp hết hàng")).toBeInTheDocument();

    expect(screen.getByText("Doanh thu 7 ngày")).toBeInTheDocument();
    expect(screen.getByText("24/09")).toBeInTheDocument();

    const orders = screen.getByRole("region", { name: "Đơn online mới nhất" });
    expect(
      within(orders).getByRole("link", { name: /DH000123/ }),
    ).toHaveAttribute("href", "/admin/orders/o1");
    expect(within(orders).getByText("Chị Lan")).toBeInTheDocument();
    expect(within(orders).getByText("Đơn mới")).toBeInTheDocument();

    const lowStock = screen.getByRole("region", { name: "Hàng tồn thấp" });
    expect(
      within(lowStock).getByRole("link", { name: "Sửa nhanh Dây điện" }),
    ).toHaveAttribute("href", "/admin/products?edit=p1");
    expect(within(lowStock).getByText("Ổ cắm")).toBeInTheDocument();
    expect(
      within(lowStock).getByRole("link", { name: /Xem tất cả/ }),
    ).toHaveAttribute("href", "/admin/products?status=low");
  });

  it("hien loi dan khi chua co don online va khong co hang sap het", async () => {
    vi.mocked(getDashboardSummary).mockResolvedValue(emptySummary);

    render(await DashboardSection());

    expect(screen.getByText("Chưa có đơn online nào")).toBeInTheDocument();
    expect(screen.getByText("Không có hàng nào sắp hết")).toBeInTheDocument();
  });
});

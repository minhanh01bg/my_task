import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminReviewsPage from "@/app/admin/reviews/page";
import { listAdminReviews } from "@/server/reviews/admin-reviews";

vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

vi.mock("@/server/reviews/admin-reviews", () => ({
  ADMIN_REVIEWS_PAGE_SIZE: 20,
  listAdminReviews: vi.fn(),
}));

const row = {
  id: "rev-1",
  authorName: "Minh Anh",
  rating: 4,
  content: "Hàng tốt",
  isVerifiedPurchase: true,
  status: "published",
  createdAt: new Date("2026-09-20T03:00:00Z"),
  product: { id: "p-1", name: "Cà phê Robusta", slug: "ca-phe-robusta" },
};

beforeEach(() => {
  vi.mocked(listAdminReviews).mockReset();
});

describe("/admin/reviews", () => {
  it("liệt kê đánh giá, nút ẩn/xoá và phân trang theo trạng thái", async () => {
    vi.mocked(listAdminReviews).mockResolvedValue({
      items: [row, { ...row, id: "rev-2", status: "hidden" }],
      total: 45,
      page: 2,
      pageSize: 20,
    });
    render(
      await AdminReviewsPage({
        searchParams: Promise.resolve({ page: "2", status: "hidden" }),
      }),
    );

    expect(listAdminReviews).toHaveBeenCalledWith({
      page: 2,
      status: "hidden",
    });
    expect(screen.getByText("Danh sách đánh giá (45)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ẩn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hiện" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Xoá" })).toHaveLength(2);
    expect(
      screen.getAllByRole("link", { name: "Cà phê Robusta" })[0],
    ).toHaveAttribute("href", "/shop/p/ca-phe-robusta");
    expect(screen.getByRole("link", { name: "Trang trước" })).toHaveAttribute(
      "href",
      "/admin/reviews?status=hidden&page=1",
    );
  });

  it("bỏ qua trạng thái lạ và hiển thị trạng thái rỗng", async () => {
    vi.mocked(listAdminReviews).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
    render(
      await AdminReviewsPage({
        searchParams: Promise.resolve({ status: "bogus" }),
      }),
    );
    expect(listAdminReviews).toHaveBeenCalledWith({
      page: 1,
      status: undefined,
    });
    expect(screen.getByText("Chưa có đánh giá nào")).toBeInTheDocument();
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminNav } from "@/features/admin-navigation/admin-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/promotions/vouchers",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/admin-search/admin-search-button", () => ({
  AdminSearchButton: () => null,
}));
vi.mock("@/features/admin-notifications/notification-button", () => ({
  NotificationButton: () => <button type="button">Thông báo</button>,
}));

describe("AdminNav — Mã giảm giá", () => {
  it("có mục Mã giảm giá dưới Khuyến mãi và chỉ mục khớp dài nhất được đánh dấu", () => {
    render(<AdminNav />);
    const sidebar = screen.getByRole("navigation", {
      name: "Điều hướng quản lý",
    });
    const links = within(sidebar).getAllByRole("link");
    const labels = links.map((link) => link.textContent);
    expect(labels.indexOf("Mã giảm giá")).toBe(
      labels.indexOf("Khuyến mãi") + 1,
    );

    const vouchers = within(sidebar).getByRole("link", { name: "Mã giảm giá" });
    expect(vouchers).toHaveAttribute("href", "/admin/promotions/vouchers");
    expect(vouchers).toHaveAttribute("aria-current", "page");
    expect(
      within(sidebar).getByRole("link", { name: "Khuyến mãi" }),
    ).not.toHaveAttribute("aria-current");
  });
});

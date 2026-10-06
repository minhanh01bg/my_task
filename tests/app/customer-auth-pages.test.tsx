import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CustomerLoginPage from "@/app/account/login/page";
import CustomerRegisterPage from "@/app/account/register/page";

vi.mock("@/server/settings/store-settings", () => ({
  getStoreName: async () => "An Phát",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

describe("customer account entry pages", () => {
  it.each([
    ["Đăng nhập khách hàng", CustomerLoginPage],
    ["Tạo tài khoản", CustomerRegisterPage],
  ] as const)(
    "%s có banner cửa hàng và lối vào admin",
    async (heading, Page) => {
      render(await Page({ searchParams: Promise.resolve({}) }));
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Khám phá sản phẩm" }),
      ).toHaveAttribute("href", "/shop");
      expect(
        screen.getByRole("link", { name: "Đăng nhập quản trị" }),
      ).toHaveAttribute("href", "/login?next=%2Fadmin");
      expect(screen.getAllByText("An Phát").length).toBeGreaterThan(0);
    },
  );
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PosScreen } from "@/components/pos/pos-screen";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

describe("PosScreen header", () => {
  it("có nút đổi giao diện sáng/tối cạnh lối vào quản lý cửa hàng", () => {
    render(
      <PosScreen
        catalog={{
          categories: [],
          products: [],
          fetchedAt: new Date().toISOString(),
        }}
        bankAccount={null}
        storeName="Tiệm An Phát"
      />,
    );

    const adminLink = screen.getByRole("link", { name: /quản lý cửa hàng/i });
    const toggle = within(adminLink.parentElement!).getByRole("button", {
      name: "Chuyển sang giao diện tối",
    });
    expect(toggle).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CatalogBrowser } from "@/features/online-store/catalog-browser";

// Giu transition o trang thai "dang cho" de thay khung skeleton khi loc.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useTransition: () =>
      [true, (callback: () => void) => callback()] as ReturnType<
        typeof actual.useTransition
      >,
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/shop",
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const catalog = {
  categories: [],
  products: [
    {
      id: "p1",
      name: "Cà phê sữa",
      price: 20_000,
      unit: "chai",
      stock: 5,
      imageUrl: null,
      categoryId: null,
      searchText: "ca phe sua",
    },
  ],
};

describe("CatalogBrowser — đang lọc", () => {
  it("hiển thị ProductCardSkeleton thay cho lưới khi transition lọc chưa xong", () => {
    render(
      <OnlineCartProvider>
        <CatalogBrowser catalog={catalog} />
      </OnlineCartProvider>,
    );

    const grid = screen.getByTestId("catalog-skeleton");
    expect(grid).toHaveAttribute("aria-busy", "true");
    expect(grid.querySelectorAll(".animate-shimmer").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cà phê sữa")).not.toBeInTheDocument();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PosScreen } from "@/components/pos/pos-screen";
import type { CartLine } from "@/lib/pricing/types";
import { useCartStore } from "@/stores/cart-store";
import { useHeldOrdersStore } from "@/stores/held-orders-store";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));
vi.mock("@/lib/client-log", () => ({ reportClientError: vi.fn() }));
vi.mock("@/lib/sync/catalog-cache", () => ({
  saveCatalog: vi.fn().mockResolvedValue(undefined),
  loadCatalog: vi.fn().mockResolvedValue(null),
  isCatalogStale: () => false,
}));
vi.mock("@/lib/sync/submit", () => ({ submitOrder: vi.fn() }));

const CATALOG = {
  categories: [],
  products: [],
  fetchedAt: new Date().toISOString(),
};

function line(name: string, unitPrice: number): CartLine {
  return {
    id: crypto.randomUUID(),
    productId: name,
    name,
    unitPrice,
    originalPrice: unitPrice,
    quantity: 1,
    discount: 0,
    unit: "cái",
    isService: false,
  };
}

describe("PosScreen — mở lại đơn đang giữ", () => {
  beforeEach(() => {
    useHeldOrdersStore.setState({ held: [] });
    useCartStore.setState({ lines: [], orderDiscount: 0 });
  });

  it("giữ lại giỏ đang bán thay vì xoá mất khi mở một đơn đang giữ", () => {
    useHeldOrdersStore.getState().hold([line("Nước suối", 10_000)], 0);
    useCartStore.setState({ lines: [line("Dép lào", 85_000)] });

    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);
    fireEvent.click(screen.getByRole("button", { name: /#1/ }));

    expect(useCartStore.getState().lines.map((l) => l.name)).toEqual([
      "Nước suối",
    ]);
    const held = useHeldOrdersStore.getState().held;
    expect(held).toHaveLength(1);
    expect(held[0]?.lines[0]?.name).toBe("Dép lào");
  });

  it("màn hình hẹp có thanh tính tiền cố định mở hộp thanh toán", async () => {
    useCartStore.setState({ lines: [line("Dép lào", 85_000)] });
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    const bar = screen.getByTestId("pos-mobile-checkout");
    expect(bar).toHaveClass("fixed", "bottom-0", "lg:hidden");
    expect(bar).toHaveTextContent("85.000");

    fireEvent.click(screen.getByRole("button", { name: /tính tiền/i }));
    expect(await screen.findByTestId("payment-total")).toHaveTextContent(
      "85.000",
    );
  });

  it("giỏ trống thì không hiện thanh tính tiền", () => {
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);
    expect(screen.queryByTestId("pos-mobile-checkout")).not.toBeInTheDocument();
  });
});

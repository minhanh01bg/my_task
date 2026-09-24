import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PosScreen } from "@/components/pos/pos-screen";
import { submitOrder } from "@/lib/sync/submit";
import { useCartStore } from "@/stores/cart-store";

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

describe("PosScreen — in hoá đơn sau khi thanh toán", () => {
  beforeEach(() => {
    useCartStore.setState({
      lines: [
        {
          id: "l1",
          productId: "p1",
          name: "Nước mắm Nam Ngư",
          unitPrice: 42_000,
          originalPrice: 42_000,
          quantity: 2,
          discount: 0,
          unit: "chai",
          isService: false,
        },
      ],
      orderDiscount: 0,
    });
    vi.mocked(submitOrder).mockResolvedValue({
      synced: true,
      order: { code: "DH000123", total: 84_000 },
    });
  });

  it("màn hình thanh toán thành công có nút In hoá đơn với đúng giỏ vừa bán", async () => {
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    fireEvent.click(screen.getByRole("button", { name: /thanh toán/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Đúng số tiền" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(
      await screen.findByText("Thanh toán thành công"),
    ).toBeInTheDocument();
    // Gio da xoa nhung hoa don van giu dong hang vua ban.
    expect(useCartStore.getState().lines).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "In hoá đơn" }));
    const receiptTitle = await screen.findByText("Hoá đơn DH000123");
    const dialog = receiptTitle.closest<HTMLElement>(
      '[data-slot="dialog-content"]',
    );
    expect(dialog).not.toBeNull();
    expect(within(dialog!).getByText("Nước mắm Nam Ngư")).toBeInTheDocument();
    expect(within(dialog!).getByText("TIỆM")).toBeInTheDocument();
  });
});

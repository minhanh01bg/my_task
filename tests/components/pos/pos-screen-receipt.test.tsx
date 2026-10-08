import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.mocked(submitOrder).mockReset();
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

  it("chỉ có một nút thanh toán trong đơn và F4 vẫn mở thanh toán", async () => {
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);
    expect(
      screen.queryByRole("button", { name: "Tính tiền" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("pos-mobile-checkout")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /thanh toán/i })).toHaveLength(
      1,
    );
    fireEvent.keyDown(window, { key: "F4" });
    expect(
      await screen.findByRole("button", { name: "Đúng số tiền" }),
    ).toBeInTheDocument();
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

  it("chuyển khoản chưa nhận tiền không báo là đã thanh toán", async () => {
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    fireEvent.click(screen.getByRole("button", { name: /thanh toán/i }));
    fireEvent.click(await screen.findByRole("tab", { name: "Chuyển khoản" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Chưa nhận được tiền" }),
    );

    expect(
      await screen.findByText("Đơn chờ nhận chuyển khoản"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Thanh toán thành công")).not.toBeInTheDocument();
    expect(screen.queryByText(/khách đưa/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Tiền thối lại")).not.toBeInTheDocument();
    expect(screen.getByText(/còn phải thu/i)).toHaveTextContent("84.000");
  });

  it("server từ chối đơn thì báo rõ, không nói là sẽ tự đồng bộ", async () => {
    vi.mocked(submitOrder).mockResolvedValue({
      synced: false,
      order: null,
      rejected: "Dữ liệu đơn hàng không hợp lệ",
    });
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    fireEvent.click(screen.getByRole("button", { name: /thanh toán/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Đúng số tiền" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(
      await screen.findByText(
        /máy chủ từ chối đơn: dữ liệu đơn hàng không hợp lệ/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/sẽ đồng bộ khi có mạng/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /xem đơn chưa gửi/i }),
    ).toHaveAttribute("href", "/admin/offline");
  });

  it("không thể lưu cả máy chủ lẫn hàng đợi thì giữ nguyên giỏ và cho thử lại", async () => {
    vi.mocked(submitOrder).mockRejectedValue(
      new Error("IndexedDB unavailable"),
    );
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    fireEvent.click(screen.getByRole("button", { name: /thanh toán/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Đúng số tiền" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /không thể lưu đơn/i,
    );
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(screen.queryByText("Thanh toán thành công")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /thanh toán/i })).toBeEnabled();
  });

  it("thử lại sau lỗi lưu dùng lại cùng clientId để tránh trùng đơn", async () => {
    vi.mocked(submitOrder)
      .mockRejectedValueOnce(new Error("IndexedDB unavailable"))
      .mockResolvedValueOnce({
        synced: true,
        order: { code: "DH000123", total: 84_000 },
      });
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    fireEvent.click(screen.getByRole("button", { name: /thanh toán/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Đúng số tiền" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /thanh toán/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Đúng số tiền" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await screen.findByText("Thanh toán thành công");

    expect(vi.mocked(submitOrder)).toHaveBeenCalledTimes(2);
    const firstId = vi.mocked(submitOrder).mock.calls[0]?.[0].clientId;
    expect(vi.mocked(submitOrder).mock.calls[1]?.[0].clientId).toBe(firstId);
  });

  it("xác nhận thanh toán khi trình duyệt HTTP không có crypto.randomUUID", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });
    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    fireEvent.click(screen.getByRole("button", { name: /thanh toán/i }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Đúng số tiền" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));

    expect(
      await screen.findByText("Thanh toán thành công"),
    ).toBeInTheDocument();
    expect(vi.mocked(submitOrder).mock.calls[0]?.[0].clientId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});

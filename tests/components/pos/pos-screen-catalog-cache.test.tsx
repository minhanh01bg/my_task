import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PosScreen } from "@/components/pos/pos-screen";
import { reportClientError } from "@/lib/client-log";
import {
  isCatalogStale,
  loadCatalog,
  saveCatalog,
} from "@/lib/sync/catalog-cache";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}));

vi.mock("@/lib/client-log", () => ({ reportClientError: vi.fn() }));

vi.mock("@/lib/sync/catalog-cache", () => ({
  saveCatalog: vi.fn(),
  loadCatalog: vi.fn(),
  isCatalogStale: vi.fn(() => false),
}));

const EMPTY_CATALOG = {
  categories: [],
  products: [],
  fetchedAt: new Date().toISOString(),
};

const CATALOG = {
  ...EMPTY_CATALOG,
  products: [
    {
      id: "p1",
      name: "Nhớt Castrol",
      sku: null,
      price: 120000,
      unit: "chai",
      stock: 3,
      imageUrl: null,
      categoryId: null,
      soldCount: 0,
      searchText: "nhot castrol",
    },
  ],
};

describe("PosScreen catalog cache", () => {
  beforeEach(() => {
    vi.mocked(reportClientError).mockClear();
    vi.mocked(isCatalogStale).mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bao loi khi khong luu duoc danh muc vao IndexedDB thay vi nuot loi", async () => {
    const failure = new Error("QuotaExceededError");
    vi.mocked(saveCatalog).mockRejectedValue(failure);
    vi.mocked(loadCatalog).mockResolvedValue(null);

    render(<PosScreen catalog={CATALOG} bankAccount={null} storeName="Tiệm" />);

    await waitFor(() => {
      expect(reportClientError).toHaveBeenCalledWith(
        failure,
        "pos.catalog.save",
      );
    });
  });

  it("bao loi khi khong doc duoc danh muc da cache", async () => {
    const failure = new Error("IDB closed");
    vi.mocked(saveCatalog).mockResolvedValue(undefined);
    vi.mocked(loadCatalog).mockRejectedValue(failure);

    render(
      <PosScreen catalog={EMPTY_CATALOG} bankAccount={null} storeName="Tiệm" />,
    );

    await waitFor(() => {
      expect(reportClientError).toHaveBeenCalledWith(
        failure,
        "pos.catalog.load",
      );
    });
  });

  it("danh mục server rỗng không ghi đè danh mục đã lưu offline", async () => {
    vi.mocked(saveCatalog).mockClear();
    vi.mocked(loadCatalog).mockResolvedValue(null);

    render(
      <PosScreen catalog={EMPTY_CATALOG} bankAccount={null} storeName="Tiệm" />,
    );

    await waitFor(() => expect(loadCatalog).toHaveBeenCalled());
    expect(saveCatalog).not.toHaveBeenCalled();
  });

  it("hết phiên khi tải lại hàng hóa thì báo thu ngân đăng nhập lại", async () => {
    const user = userEvent.setup();
    vi.mocked(saveCatalog).mockClear().mockResolvedValue(undefined);
    vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
    vi.mocked(isCatalogStale).mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ message: "Chưa đăng nhập" }, { status: 401 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PosScreen catalog={EMPTY_CATALOG} bankAccount={null} storeName="Tiệm" />,
    );
    await user.click(
      await screen.findByRole("button", { name: /Tải lại hàng hóa/ }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Phiên đăng nhập đã hết hạn",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/catalog", expect.anything());
    expect(saveCatalog).not.toHaveBeenCalled();
  });
});

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PosScreen } from "@/components/pos/pos-screen";
import { reportClientError } from "@/lib/client-log";
import { loadCatalog, saveCatalog } from "@/lib/sync/catalog-cache";

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
  isCatalogStale: () => false,
}));

const EMPTY_CATALOG = {
  categories: [],
  products: [],
  fetchedAt: new Date().toISOString(),
};

describe("PosScreen catalog cache", () => {
  beforeEach(() => {
    vi.mocked(reportClientError).mockClear();
  });

  it("bao loi khi khong luu duoc danh muc vao IndexedDB thay vi nuot loi", async () => {
    const failure = new Error("QuotaExceededError");
    vi.mocked(saveCatalog).mockRejectedValue(failure);
    vi.mocked(loadCatalog).mockResolvedValue(null);

    render(
      <PosScreen catalog={EMPTY_CATALOG} bankAccount={null} storeName="Tiệm" />,
    );

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
});

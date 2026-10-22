import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProductsPage from "@/app/(management)/admin/products/page";
import { ToastProvider } from "@/components/ui/toast";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";

vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ userId: "admin" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Admin Products - Low stock inventory alerts", () => {
  it("hiển thị cảnh báo khi có sản phẩm dưới ngưỡng an toàn tồn kho (<= 5)", async () => {
    // Tạo 1 sản phẩm có tồn kho thấp
    const lowStockProduct = await prisma.product.create({
      data: {
        name: "Sữa đặc Ngôi Sao",
        sku: "TEST-LOW-1",
        price: 24_000,
        stock: 3,
        unit: "lon",
        searchText: "sua dac ngoi sao",
      },
    });

    try {
      const page = await ProductsPage({
        searchParams: Promise.resolve({}),
      });

      render(<ToastProvider>{page}</ToastProvider>);

      expect(requireAdminSession).toHaveBeenCalledWith({
        redirectToLogin: true,
      });
      expect(screen.getByTestId("low-stock-alert")).toBeInTheDocument();
      expect(screen.getByText(/cảnh báo tồn kho thấp/i)).toBeInTheDocument();
    } finally {
      await prisma.product.delete({ where: { id: lowStockProduct.id } });
    }
  });
});

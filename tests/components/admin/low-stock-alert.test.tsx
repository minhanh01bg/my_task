import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ProductsPage from "@/app/admin/products/page";
import { prisma } from "@/server/db/prisma";

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

      render(page);

      expect(screen.getByTestId("low-stock-alert")).toBeInTheDocument();
      expect(screen.getByText(/cảnh báo tồn kho thấp/i)).toBeInTheDocument();
    } finally {
      await prisma.product.delete({ where: { id: lowStockProduct.id } });
    }
  });
});

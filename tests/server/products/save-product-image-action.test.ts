import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db/prisma";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import { saveProductAction } from "@/app/admin/products/actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("saveProductAction — xử lý lưu và bỏ ảnh sản phẩm", () => {
  beforeEach(async () => {
    await prisma.product.deleteMany({
      where: { name: { startsWith: "Test Image Product" } },
    });
    vi.restoreAllMocks();
  });

  it("lưu đúng imageUrl khi truyền qua formData (ảnh đã upload hoặc ảnh có sẵn)", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: "admin-1", username: "admin", role: "admin", version: 1 },
    });

    const formData = new FormData();
    formData.set("name", "Test Image Product 1");
    formData.set("unit", "gói");
    formData.set("price", "25000");
    formData.set("costPrice", "15000");
    formData.set("stock", "50");
    formData.set("imageUrl", "/uploads/products/test-image-123.webp");

    const result = await saveProductAction(formData);
    expect(result.ok).toBe(true);

    const saved = await prisma.product.findFirst({
      where: { name: "Test Image Product 1" },
    });
    expect(saved).not.toBeNull();
    expect(saved?.imageUrl).toBe("/uploads/products/test-image-123.webp");
  });

  it("cho phép xoá ảnh (bỏ ảnh) khi truyền imageUrl rỗng", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: "admin-1", username: "admin", role: "admin", version: 1 },
    });

    // Tạo sản phẩm có ảnh trước
    const existing = await prisma.product.create({
      data: {
        name: "Test Image Product 2",
        unit: "gói",
        price: 25000,
        costPrice: 15000,
        stock: 50,
        imageUrl: "/uploads/products/old-image.webp",
        isActive: true,
        searchText: "test image product 2",
      },
    });

    // Cập nhật với imageUrl = "" (bỏ ảnh)
    const formData = new FormData();
    formData.set("id", existing.id);
    formData.set("name", "Test Image Product 2");
    formData.set("unit", "gói");
    formData.set("price", "25000");
    formData.set("costPrice", "15000");
    formData.set("stock", "50");
    formData.set("imageUrl", "");

    const result = await saveProductAction(formData);
    expect(result.ok).toBe(true);

    const updated = await prisma.product.findUnique({
      where: { id: existing.id },
    });
    expect(updated?.imageUrl).toBeNull();
  });
});

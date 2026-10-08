import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db/prisma";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import { saveProductAction } from "@/app/(management)/admin/products/actions";

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

  it("đổi danh mục sản phẩm có ảnh mặc định mà không làm mất ảnh", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: "admin-1", username: "admin", role: "admin", version: 1 },
    });
    const category = await prisma.category.upsert({
      where: { id: "test-image-category" },
      update: {},
      create: { id: "test-image-category", name: "Danh mục ảnh mới" },
    });
    const existing = await prisma.product.create({
      data: {
        name: "Test Image Product Category",
        unit: "gói",
        price: 4500,
        costPrice: 3600,
        stock: 5.5,
        imageUrl: "/products/mi-hao-hao.webp",
        isActive: true,
        searchText: "test image product category",
      },
    });
    const formData = new FormData();
    Object.entries({
      id: existing.id,
      name: existing.name,
      unit: existing.unit,
      price: String(existing.price),
      costPrice: String(existing.costPrice),
      stock: String(existing.stock),
      imageUrl: existing.imageUrl!,
      categoryId: category.id,
    }).forEach(([key, value]) => formData.set(key, value));
    expect(await saveProductAction(formData)).toEqual({ ok: true });
    const updated = await prisma.product.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(updated.categoryId).toBe(category.id);
    expect(updated.imageUrl).toBe(existing.imageUrl);
    expect(updated.stock).toBe(5.5);
    expect(updated.searchText).toContain("danh muc anh moi");
  });

  it.each([
    "/products/../secret.webp",
    "/products/sub/secret.webp",
    "/other/image.webp",
    "javascript:alert(1)",
  ])(
    "từ chối đường dẫn ảnh không hợp lệ %s bằng thông báo tiếng Việt",
    async (imageUrl) => {
      vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
        authorized: true,
        identity: {
          id: "admin-1",
          username: "admin",
          role: "admin",
          version: 1,
        },
      });
      const formData = new FormData();
      Object.entries({
        name: "Test Image Product Invalid",
        unit: "gói",
        price: "1000",
        costPrice: "0",
        stock: "1",
        imageUrl,
      }).forEach(([key, value]) => formData.set(key, value));
      expect(await saveProductAction(formData)).toEqual({
        ok: false,
        message: "Đường dẫn ảnh sản phẩm không hợp lệ",
      });
      expect(
        await prisma.product.count({
          where: { name: "Test Image Product Invalid" },
        }),
      ).toBe(0);
    },
  );

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

  it("từ chối khi tên sản phẩm chỉ toàn khoảng trắng", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: "admin-1", username: "admin", role: "admin", version: 1 },
    });

    const formData = new FormData();
    formData.set("name", "    ");
    formData.set("unit", "cái");
    formData.set("price", "10000");
    formData.set("costPrice", "5000");
    formData.set("stock", "10");

    const result = await saveProductAction(formData);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Tên sản phẩm không được để trống/i);
  });

  it("tự động trim tên và đơn vị sản phẩm khi lưu", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: "admin-1", username: "admin", role: "admin", version: 1 },
    });

    const formData = new FormData();
    formData.set("name", "  Test Image Product Trimmed  ");
    formData.set("unit", "  gói  ");
    formData.set("price", "20000");
    formData.set("costPrice", "10000");
    formData.set("stock", "5");

    const result = await saveProductAction(formData);
    expect(result.ok).toBe(true);

    const saved = await prisma.product.findFirst({
      where: { name: "Test Image Product Trimmed" },
    });
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Test Image Product Trimmed");
    expect(saved?.unit).toBe("gói");
  });
});

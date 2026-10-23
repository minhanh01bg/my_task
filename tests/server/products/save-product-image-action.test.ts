import { access, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { logger } from "@/lib/logger";
import { prisma } from "@/server/db/prisma";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import * as saveImageModule from "@/server/products/save-image";
import * as saveProductModule from "@/server/products/save-product";
import {
  PRODUCT_STOCK_CONFLICT_MESSAGE,
  ProductStockConflictError,
} from "@/server/products/save-product";
import { saveProductAction } from "@/app/(management)/admin/products/actions";

const UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads");

function uploadPath(imageUrl: string): string {
  return path.join(UPLOAD_DIR, path.basename(imageUrl));
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

async function pngFile(): Promise<File> {
  const buffer = await sharp({
    create: { width: 40, height: 40, channels: 3, background: "#c82828" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buffer)], "anh.png", { type: "image/png" });
}

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

  it.each([
    "/uploads/0123abcd.webp",
    "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400",
  ])("chấp nhận ảnh %s (WEB-7a, WB-7)", async (imageUrl) => {
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
      name: "Test Image Product Valid",
      unit: "gói",
      price: "1000",
      costPrice: "0",
      stock: "1",
      imageUrl,
    }).forEach(([key, value]) => formData.set(key, value));

    expect(await saveProductAction(formData)).toEqual({ ok: true });
    const saved = await prisma.product.findFirst({
      where: { name: "Test Image Product Valid" },
    });
    expect(saved?.imageUrl).toBe(imageUrl);
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
      originalStock: String(existing.stock),
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
    // WEB-7a: chỉ https công khai hoặc đường dẫn nội bộ
    "http://example.com/a.webp",
    "//evil.com/a.webp",
    "data:image/png;base64,AAAA",
    "https://127.0.0.1/a.webp",
    "https://[::1]/a.webp",
    "https://user:pass@example.com/a.webp",
    // WB-7: next/image chỉ cho images.unsplash.com; POS tải thẳng URL ảnh
    "https://example.com/a.jpg",
    "https://cdn.example.com/a.webp",
    "http://images.unsplash.com/x",
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
        message:
          "Ảnh sản phẩm chỉ được dùng ảnh tải lên hoặc ảnh từ images.unsplash.com",
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
    formData.set("originalStock", "50");
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

    expect(await saveProductAction(formData)).toEqual({
      ok: false,
      message: expect.stringMatching(/Tên sản phẩm không được để trống/i),
    });
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

  describe("lưu sản phẩm lỗi sau khi đã tải ảnh lên", () => {
    const written: string[] = [];
    let upload: MockInstance<typeof saveImageModule.saveProductImage>;

    beforeEach(() => {
      vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
        authorized: true,
        identity: {
          id: "admin-1",
          username: "admin",
          role: "admin",
          version: 1,
        },
      });
      upload = vi.spyOn(saveImageModule, "saveProductImage");
    });

    afterEach(async () => {
      for (const file of written.splice(0)) await rm(file, { force: true });
    });

    /** Ảnh action vừa ghi ra public/uploads (spy vẫn gọi hàm thật). */
    function uploadedImageUrl(): string {
      expect(upload).toHaveBeenCalledOnce();
      const settled = upload.mock.settledResults[0];
      if (settled?.type !== "fulfilled" || !settled.value.ok) {
        throw new Error("Action không tải được ảnh lên");
      }
      written.push(uploadPath(settled.value.imageUrl));
      return settled.value.imageUrl;
    }

    async function formWithUpload(values: Record<string, string> = {}) {
      const formData = new FormData();
      Object.entries({
        name: "Test Image Product Upload",
        unit: "gói",
        price: "1000",
        costPrice: "0",
        stock: "1",
        ...values,
      }).forEach(([key, value]) => formData.set(key, value));
      formData.set("image", await pngFile());
      return formData;
    }

    it("xoá ảnh vừa tải, giữ ảnh cũ của sản phẩm (tồn kho xung đột)", async () => {
      const keptUrl = "/uploads/test-image-product-kept.webp";
      written.push(uploadPath(keptUrl));
      await writeFile(uploadPath(keptUrl), "anh cu");
      // Form mở lúc tồn kho 10, sau đó đã bán 5.
      const existing = await prisma.product.create({
        data: {
          name: "Test Image Product Upload",
          unit: "gói",
          price: 1000,
          costPrice: 0,
          stock: 5,
          imageUrl: keptUrl,
          isActive: true,
          searchText: "test image product upload",
        },
      });

      const result = await saveProductAction(
        await formWithUpload({
          id: existing.id,
          stock: "8",
          originalStock: "10",
          imageUrl: keptUrl,
        }),
      );

      expect(result).toEqual({
        ok: false,
        message: PRODUCT_STOCK_CONFLICT_MESSAGE,
      });
      expect(await exists(uploadPath(uploadedImageUrl()))).toBe(false);
      expect(await exists(uploadPath(keptUrl))).toBe(true);
      const saved = await prisma.product.findUniqueOrThrow({
        where: { id: existing.id },
      });
      expect(saved.imageUrl).toBe(keptUrl);
    });

    it("lỗi lạ vẫn ném lại sau khi xoá ảnh vừa tải", async () => {
      vi.spyOn(saveProductModule, "saveProduct").mockRejectedValue(
        new Error("db down"),
      );

      await expect(saveProductAction(await formWithUpload())).rejects.toThrow(
        "db down",
      );
      expect(await exists(uploadPath(uploadedImageUrl()))).toBe(false);
    });

    it("xoá ảnh lỗi thì ghi log và vẫn trả lỗi lưu sản phẩm gốc", async () => {
      vi.spyOn(saveProductModule, "saveProduct").mockRejectedValue(
        new ProductStockConflictError(),
      );
      vi.spyOn(saveImageModule, "deleteProductImage").mockRejectedValue(
        new Error("EBUSY"),
      );
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});

      expect(await saveProductAction(await formWithUpload())).toEqual({
        ok: false,
        message: PRODUCT_STOCK_CONFLICT_MESSAGE,
      });
      expect(warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ imageUrl: uploadedImageUrl() }),
      );
    });
  });
});

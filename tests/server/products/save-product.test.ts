import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { saveProduct, softDeleteProduct } from "@/server/products/save-product";

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("saveProduct", () => {
  it("tao san pham moi", async () => {
    const { id } = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.name).toBe("Đường trắng");
    expect(saved.price).toBe(25000);
  });

  it("luu duong dan anh san pham", async () => {
    const { id } = await saveProduct({
      name: "Bugi NGK",
      unit: "cái",
      price: 35000,
      costPrice: 24000,
      stock: 20,
      imageUrl: "https://example.com/bugi-ngk.jpg",
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.imageUrl).toBe("https://example.com/bugi-ngk.jpg");
  });

  it("sinh searchText da bo dau", async () => {
    const { id } = await saveProduct({
      name: "Nhớt Castrol Power1",
      unit: "chai",
      price: 120000,
      costPrice: 95000,
      stock: 10,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.searchText).toContain("nhot castrol power1");
  });

  it("gop ca aliases va sku vao searchText", async () => {
    const { id } = await saveProduct({
      name: "Bugi NGK C7HSA",
      sku: "PT-102",
      aliases: "bugi wave, bugi thường",
      unit: "cái",
      price: 35000,
      costPrice: 24000,
      stock: 20,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.searchText).toContain("bugi wave");
    expect(saved.searchText).toContain("bugi thuong");
    expect(saved.searchText).toContain("pt-102");
  });

  it("gop ten danh muc vao searchText", async () => {
    const category = await prisma.category.create({
      data: { name: "Phụ tùng xe", sortOrder: 1 },
    });

    const { id } = await saveProduct({
      name: "Ruột xe máy",
      categoryId: category.id,
      unit: "cái",
      price: 55000,
      costPrice: 38000,
      stock: 5,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.searchText).toContain("phu tung xe");
  });

  it("sua san pham cu va cap nhat lai searchText", async () => {
    const created = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    await saveProduct({
      id: created.id,
      name: "Đường vàng",
      unit: "kg",
      price: 27000,
      costPrice: 22000,
      stock: 40,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(saved.name).toBe("Đường vàng");
    expect(saved.searchText).toContain("duong vang");
    expect(saved.searchText).not.toContain("duong trang");
  });

  it("khong tao ban ghi thu hai khi sua", async () => {
    const created = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    await saveProduct({
      id: created.id,
      name: "Đường trắng",
      unit: "kg",
      price: 26000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    expect(await prisma.product.count()).toBe(1);
  });
});

const BASE_INPUT = {
  unit: "cái",
  price: 35000,
  costPrice: 24000,
  stock: 20,
  isActive: true,
};

async function slugOf(id: string): Promise<string | null> {
  const row = await prisma.product.findUniqueOrThrow({
    where: { id },
    select: { slug: true },
  });
  return row.slug;
}

describe("saveProduct — slug SEO", () => {
  it("sinh slug bỏ dấu từ tên khi tạo", async () => {
    const { id } = await saveProduct({
      ...BASE_INPUT,
      name: "Cà phê Robusta 500g",
    });
    expect(await slugOf(id)).toBe("ca-phe-robusta-500g");
  });

  it("trùng tên thì thêm hậu tố -2, -3", async () => {
    const first = await saveProduct({ ...BASE_INPUT, name: "Bugi NGK" });
    const second = await saveProduct({ ...BASE_INPUT, name: "Bugi  NGK!" });
    const third = await saveProduct({ ...BASE_INPUT, name: "bugi ngk" });

    expect(await slugOf(first.id)).toBe("bugi-ngk");
    expect(await slugOf(second.id)).toBe("bugi-ngk-2");
    expect(await slugOf(third.id)).toBe("bugi-ngk-3");
  });

  it("giữ nguyên slug khi sửa mà không đổi tên (URL ổn định)", async () => {
    const { id } = await saveProduct({ ...BASE_INPUT, name: "Bugi NGK" });
    await saveProduct({ ...BASE_INPUT, id, name: "Bugi NGK", price: 40000 });

    expect(await slugOf(id)).toBe("bugi-ngk");
  });

  it("đổi tên thì sinh slug mới, bỏ qua slug của chính sản phẩm", async () => {
    const { id } = await saveProduct({ ...BASE_INPUT, name: "Bugi NGK" });

    await saveProduct({ ...BASE_INPUT, id, name: "BUGI ngk" });
    expect(await slugOf(id)).toBe("bugi-ngk");

    await saveProduct({ ...BASE_INPUT, id, name: "Bugi Denso" });
    expect(await slugOf(id)).toBe("bugi-denso");
  });

  it("đổi tên trùng sản phẩm khác thì nhận hậu tố", async () => {
    await saveProduct({ ...BASE_INPUT, name: "Bugi Denso" });
    const { id } = await saveProduct({ ...BASE_INPUT, name: "Bugi NGK" });

    await saveProduct({ ...BASE_INPUT, id, name: "Bugi Denso" });
    expect(await slugOf(id)).toBe("bugi-denso-2");
  });

  it("sản phẩm cũ chưa có slug được gán slug ở lần sửa kế tiếp", async () => {
    const legacy = await prisma.product.create({
      data: { name: "Nhớt Castrol", price: 1000 },
    });
    expect(legacy.slug).toBeNull();

    await saveProduct({ ...BASE_INPUT, id: legacy.id, name: "Nhớt Castrol" });
    expect(await slugOf(legacy.id)).toBe("nhot-castrol");
  });

  it("tên không có chữ/số dùng slug dự phòng", async () => {
    const { id } = await saveProduct({ ...BASE_INPUT, name: "!!!" });
    expect(await slugOf(id)).toBe("san-pham");
  });
});

describe("softDeleteProduct", () => {
  it("xoa mem — van con ban ghi nhung khong hien o POS", async () => {
    const { id } = await saveProduct({
      name: "Đường trắng",
      unit: "kg",
      price: 25000,
      costPrice: 21000,
      stock: 40,
      isActive: true,
    });

    await softDeleteProduct(id);

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.deletedAt).not.toBeNull();
    expect(saved.isActive).toBe(false);
  });
});

describe("saveProduct — anh", () => {
  it("luu duoc duong dan anh", async () => {
    const { id } = await saveProduct({
      name: "Bugi Wave",
      unit: "cái",
      price: 15000,
      costPrice: 10000,
      stock: 10,
      isActive: true,
      imageUrl: "/uploads/abc.webp",
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.imageUrl).toBe("/uploads/abc.webp");
  });

  it("khong truyen imageUrl thi khong xoa mat anh dang co", async () => {
    const { id } = await saveProduct({
      name: "Bugi Wave",
      unit: "cái",
      price: 15000,
      costPrice: 10000,
      stock: 10,
      isActive: true,
      imageUrl: "/uploads/abc.webp",
    });

    await saveProduct({
      id,
      name: "Bugi Wave 110",
      unit: "cái",
      price: 16000,
      costPrice: 10000,
      stock: 10,
      isActive: true,
    });

    const saved = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(saved.imageUrl).toBe("/uploads/abc.webp");
  });
});

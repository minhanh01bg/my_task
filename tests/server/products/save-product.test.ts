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

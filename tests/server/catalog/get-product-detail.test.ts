import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getOnlineProductDetail } from "@/server/catalog/get-product-detail";
import { prisma } from "@/server/db/prisma";

const testCatId = "test-cat-detail-01";
const testProd1Id = "test-prod-detail-01";
const testProd2Id = "test-prod-detail-02";
const testInactiveProdId = "test-prod-detail-inactive";

beforeEach(async () => {
  await prisma.product.deleteMany({
    where: {
      id: { in: [testProd1Id, testProd2Id, testInactiveProdId] },
    },
  });
  await prisma.category.deleteMany({
    where: { id: testCatId },
  });
});

afterEach(async () => {
  await prisma.product.deleteMany({
    where: {
      id: { in: [testProd1Id, testProd2Id, testInactiveProdId] },
    },
  });
  await prisma.category.deleteMany({
    where: { id: testCatId },
  });
});

describe("getOnlineProductDetail", () => {
  it("trả về thông tin chi tiết sản phẩm và các sản phẩm liên quan cùng danh mục", async () => {
    await prisma.category.create({
      data: {
        id: testCatId,
        name: "Nước giải khát",
      },
    });

    await prisma.product.create({
      data: {
        id: testProd1Id,
        name: "Nước Cam Ép Tươi",
        sku: "CAM-001",
        price: 35_000,
        costPrice: 20_000,
        unit: "chai",
        stock: 50,
        categoryId: testCatId,
        isActive: true,
        isService: false,
      },
    });

    await prisma.product.create({
      data: {
        id: testProd2Id,
        name: "Nước Chanh Dây",
        sku: "CHANH-002",
        price: 30_000,
        unit: "chai",
        stock: 20,
        categoryId: testCatId,
        isActive: true,
        isService: false,
      },
    });

    const result = await getOnlineProductDetail(testProd1Id);
    expect(result).not.toBeNull();
    expect(result?.product.id).toBe(testProd1Id);
    expect(result?.product.name).toBe("Nước Cam Ép Tươi");
    expect(result?.product.sku).toBe("CAM-001");
    expect(result?.product.category?.name).toBe("Nước giải khát");
    // Does not expose costPrice
    expect(
      (result?.product as unknown as Record<string, unknown>).costPrice,
    ).toBeUndefined();

    // Related products in same category
    expect(result?.relatedProducts.length).toBe(1);
    expect(result?.relatedProducts[0].id).toBe(testProd2Id);
  });

  it("trả về null nếu sản phẩm bị ẩn (isActive = false) hoặc đã bị xóa", async () => {
    await prisma.product.create({
      data: {
        id: testInactiveProdId,
        name: "Hàng Ẩn",
        price: 10_000,
        isActive: false,
        unit: "cái",
      },
    });

    const result = await getOnlineProductDetail(testInactiveProdId);
    expect(result).toBeNull();

    const notFoundResult = await getOnlineProductDetail("non-existent-id");
    expect(notFoundResult).toBeNull();
  });
});

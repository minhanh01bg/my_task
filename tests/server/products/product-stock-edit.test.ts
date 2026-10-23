import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  quickUpdateProductAction,
  saveProductAction,
} from "@/app/(management)/admin/products/actions";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// BL-2: sửa sản phẩm không được ghi đè tồn kho bằng số form đã tải từ trước.
const PREFIX = "Test Stock Edit";
const ADMIN_ID = "test-stock-edit-admin";
const STOCK_CONFLICT_MESSAGE =
  "Tồn kho đã thay đổi (có đơn mới). Vui lòng tải lại trang rồi sửa lại.";

function formOf(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function createProduct(
  name: string,
  overrides: { stock?: number; isActive?: boolean } = {},
) {
  return prisma.product.create({
    data: {
      name: `${PREFIX} ${name}`,
      unit: "cái",
      price: 10_000,
      costPrice: 6_000,
      stock: overrides.stock ?? 10,
      isActive: overrides.isActive ?? true,
      searchText: "test stock edit",
    },
  });
}

/** Bán 5 cái sau khi admin đã mở form ở tồn kho 10. */
async function sellFive(productId: string) {
  await prisma.product.update({
    where: { id: productId },
    data: { stock: { decrement: 5 } },
  });
}

function fullForm(
  product: { id: string; name: string },
  values: Record<string, string>,
): FormData {
  return formOf({
    id: product.id,
    name: product.name,
    unit: "cái",
    price: "10000",
    costPrice: "6000",
    ...values,
  });
}

async function adjustMovements(productId: string) {
  return prisma.stockMovement.findMany({
    where: { productId, reason: "adjust" },
    select: { delta: true, reason: true },
  });
}

describe("sửa sản phẩm không ghi đè tồn kho đã bán (BL-2)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await prisma.stockMovement.deleteMany({
      where: { product: { name: { startsWith: PREFIX } } },
    });
    await prisma.product.deleteMany({
      where: { name: { startsWith: PREFIX } },
    });
    await prisma.adminAuditEvent.deleteMany({
      where: { identityId: ADMIN_ID },
    });
    await prisma.adminIdentity.upsert({
      where: { id: ADMIN_ID },
      update: {},
      create: { id: ADMIN_ID, username: ADMIN_ID },
    });
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: ADMIN_ID, username: ADMIN_ID, role: "owner", version: 1 },
    });
  });

  it("form đầy đủ: đổi giá với tồn kho cũ giữ nguyên tồn kho đã bán", async () => {
    const product = await createProduct("Gia");
    await sellFive(product.id);

    const result = await saveProductAction(
      fullForm(product, { price: "12000", stock: "10", originalStock: "10" }),
    );

    expect(result).toEqual({ ok: true });
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.price).toBe(12_000);
    expect(saved.stock).toBe(5);
    expect(await adjustMovements(product.id)).toEqual([]);
  });

  it("form đầy đủ: tồn kho đổi khi kho đã thay đổi thì báo lỗi và không ghi gì", async () => {
    const product = await createProduct("Xung dot");
    await sellFive(product.id);

    const result = await saveProductAction(
      fullForm(product, { price: "12000", stock: "8", originalStock: "10" }),
    );

    expect(result).toEqual({ ok: false, message: STOCK_CONFLICT_MESSAGE });
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.stock).toBe(5);
    expect(saved.price).toBe(10_000);
    expect(await adjustMovements(product.id)).toEqual([]);
  });

  it("form đầy đủ: điều chỉnh tồn kho ghi phiếu adjust và nhật ký admin", async () => {
    const product = await createProduct("Dieu chinh", { stock: 5.5 });

    const result = await saveProductAction(
      fullForm(product, { stock: "8", originalStock: "5.5" }),
    );

    expect(result).toEqual({ ok: true });
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.stock).toBe(8);
    expect(await adjustMovements(product.id)).toEqual([
      { delta: 2.5, reason: "adjust" },
    ]);
    const audit = await prisma.adminAuditEvent.findFirst({
      where: { identityId: ADMIN_ID, entityId: product.id },
    });
    expect(audit?.action).toBe("product.stock_adjust");
    expect(audit?.entityType).toBe("product");
    expect(JSON.parse(audit?.metadata ?? "{}")).toEqual({
      previousStock: 5.5,
      stock: 8,
      delta: 2.5,
    });
  });

  it("form đầy đủ: sửa thiếu originalStock thì từ chối", async () => {
    const product = await createProduct("Thieu goc");

    const result = await saveProductAction(fullForm(product, { stock: "7" }));

    expect(result.ok).toBe(false);
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.stock).toBe(10);
  });

  it("form đầy đủ: tạo mới vẫn đặt tồn kho ban đầu", async () => {
    const result = await saveProductAction(
      formOf({
        name: `${PREFIX} Moi`,
        unit: "cái",
        price: "10000",
        costPrice: "6000",
        stock: "12",
      }),
    );

    expect(result).toEqual({ ok: true });
    const created = await prisma.product.findFirstOrThrow({
      where: { name: `${PREFIX} Moi` },
    });
    expect(created.stock).toBe(12);
    expect(created.isActive).toBe(true);
  });

  it("form đầy đủ: lưu sản phẩm đang ẩn không làm nó hiện lại", async () => {
    const product = await createProduct("An", { isActive: false });

    const result = await saveProductAction(
      fullForm(product, { price: "11000", stock: "10", originalStock: "10" }),
    );

    expect(result).toEqual({ ok: true });
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.price).toBe(11_000);
    expect(saved.isActive).toBe(false);
  });

  it("sửa nhanh: đổi giá với tồn kho cũ giữ nguyên tồn kho đã bán", async () => {
    const product = await createProduct("Nhanh gia");
    await sellFive(product.id);

    const result = await quickUpdateProductAction(
      formOf({
        id: product.id,
        price: "15000",
        stock: "10",
        originalStock: "10",
      }),
    );

    expect(result).toEqual({ ok: true });
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.price).toBe(15_000);
    expect(saved.stock).toBe(5);
    expect(await adjustMovements(product.id)).toEqual([]);
  });

  it("sửa nhanh: tồn kho đổi khi kho đã thay đổi thì báo lỗi và không ghi gì", async () => {
    const product = await createProduct("Nhanh xung dot");
    await sellFive(product.id);

    const result = await quickUpdateProductAction(
      formOf({
        id: product.id,
        price: "15000",
        stock: "20",
        originalStock: "10",
      }),
    );

    expect(result).toEqual({ ok: false, message: STOCK_CONFLICT_MESSAGE });
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.stock).toBe(5);
    expect(saved.price).toBe(10_000);
    expect(await adjustMovements(product.id)).toEqual([]);
  });

  it("sửa nhanh: điều chỉnh tồn kho ghi phiếu adjust và nhật ký admin", async () => {
    const product = await createProduct("Nhanh dieu chinh");

    const result = await quickUpdateProductAction(
      formOf({
        id: product.id,
        price: "10000",
        stock: "4",
        originalStock: "10",
      }),
    );

    expect(result).toEqual({ ok: true });
    const saved = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(saved.stock).toBe(4);
    expect(await adjustMovements(product.id)).toEqual([
      { delta: -6, reason: "adjust" },
    ]);
    const audit = await prisma.adminAuditEvent.findFirst({
      where: { identityId: ADMIN_ID, entityId: product.id },
    });
    expect(audit?.action).toBe("product.stock_adjust");
  });

  it("sửa nhanh: sản phẩm đã xoá trả về không tìm thấy", async () => {
    const product = await createProduct("Nhanh da xoa");
    await prisma.product.update({
      where: { id: product.id },
      data: { deletedAt: new Date(), isActive: false },
    });

    const result = await quickUpdateProductAction(
      formOf({
        id: product.id,
        price: "15000",
        stock: "10",
        originalStock: "10",
      }),
    );

    expect(result).toEqual({ ok: false, message: "Không tìm thấy sản phẩm" });
  });
});

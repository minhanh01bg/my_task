import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildSearchText } from "@/lib/search/search-text";
import { ADMIN_SEARCH_GROUP_LIMIT, searchAdmin } from "@/server/admin/search";
import { prisma } from "@/server/db/prisma";

// Token hiem de khong dung du lieu cua cac file test khac trong cung DB.
const TOKEN = "Qzt19";
const PRODUCT_IDS = Array.from({ length: 7 }, (_, i) => `t19-product-${i}`);
const DELETED_PRODUCT_ID = "t19-product-deleted";
const ORDER_IDS = ["t19-order-online", "t19-order-pos", "t19-order-plus"];
const CUSTOMER_ID = "t19-pos-customer";
const ACCOUNT_IDS = Array.from({ length: 7 }, (_, i) => `t19-account-${i}`);

async function cleanup() {
  await prisma.order.deleteMany({ where: { id: { in: ORDER_IDS } } });
  await prisma.customer.deleteMany({ where: { id: CUSTOMER_ID } });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: ACCOUNT_IDS } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: [...PRODUCT_IDS, DELETED_PRODUCT_ID] } },
  });
}

beforeAll(async () => {
  await cleanup();
  await prisma.product.createMany({
    data: [
      ...PRODUCT_IDS.map((id, i) => {
        const name = `Ốc vít ${TOKEN} số ${i}`;
        return {
          id,
          name,
          sku: `T19-SKU-${i}`,
          searchText: buildSearchText({ name, sku: `T19-SKU-${i}` }),
        };
      }),
      {
        id: DELETED_PRODUCT_ID,
        name: `Ốc vít ${TOKEN} đã xoá`,
        searchText: buildSearchText({ name: `Ốc vít ${TOKEN} đã xoá` }),
        deletedAt: new Date(),
      },
    ],
  });
  await prisma.customer.create({
    data: { id: CUSTOMER_ID, name: `Chú Tư ${TOKEN}`, phone: "0919000191" },
  });
  await prisma.order.createMany({
    data: [
      {
        id: ORDER_IDS[0],
        clientId: "t19-client-online",
        code: "DH9190001",
        channel: "online",
        status: "pending",
        contactName: `Trần Online ${TOKEN}`,
        contactPhone: "0988190190",
        total: 120_000,
        subtotal: 120_000,
      },
      {
        id: ORDER_IDS[1],
        clientId: "t19-client-pos",
        code: "DH9190002",
        channel: "pos",
        status: "paid",
        customerId: CUSTOMER_ID,
        total: 50_000,
        subtotal: 50_000,
      },
    ],
  });
  await prisma.customerAccount.createMany({
    data: ACCOUNT_IDS.map((id, i) => ({
      id,
      displayName: `Khách ${TOKEN} ${i}`,
      phoneNormalized: `09771919${String(i).padStart(2, "0")}`,
      passwordHash: "secret-hash-should-never-leak",
    })),
  });
});

afterAll(cleanup);

describe("searchAdmin", () => {
  it("chuỗi rỗng không truy vấn gì và trả nhóm rỗng", async () => {
    await expect(searchAdmin("   ")).resolves.toEqual({
      products: [],
      orders: [],
      customers: [],
    });
  });

  it("sản phẩm khớp searchText không dấu, bỏ hàng đã xoá, tối đa 5", async () => {
    const result = await searchAdmin(`oc vit ${TOKEN.toLowerCase()}`);
    expect(result.products).toHaveLength(ADMIN_SEARCH_GROUP_LIMIT);
    expect(result.products.map((p) => p.id)).not.toContain(DELETED_PRODUCT_ID);
    const first = result.products[0];
    expect(Object.keys(first).sort()).toEqual(["href", "id", "name", "sku"]);
    expect(first.href).toBe(
      `/admin/products?q=${encodeURIComponent(first.name)}&edit=${first.id}`,
    );
  });

  it("mã đơn DH… khớp chính xác (không phân biệt hoa thường)", async () => {
    const result = await searchAdmin("dh9190002");
    expect(result.orders).toEqual([
      expect.objectContaining({
        id: ORDER_IDS[1],
        code: "DH9190002",
        customerName: `Chú Tư ${TOKEN}`,
        total: 50_000,
        href: `/admin/orders/${ORDER_IDS[1]}`,
      }),
    ]);
  });

  it("số điện thoại: khớp startsWith, đổi +84 thành 0, cả khách liên kết", async () => {
    const online = await searchAdmin("+84988190");
    expect(online.orders.map((o) => o.id)).toEqual([ORDER_IDS[0]]);
    expect(online.orders[0].customerName).toBe(`Trần Online ${TOKEN}`);

    const pos = await searchAdmin("0919000");
    expect(pos.orders.map((o) => o.id)).toEqual([ORDER_IDS[1]]);
  });

  it("tên liên hệ hoặc tên khách liên kết (contains)", async () => {
    const result = await searchAdmin(TOKEN);
    expect(result.orders.map((o) => o.id).sort()).toEqual(
      [ORDER_IDS[0], ORDER_IDS[1]].sort(),
    );
  });

  it("khách hàng theo tên hoặc số điện thoại, tối đa 5, không lộ passwordHash", async () => {
    const byName = await searchAdmin(`Khách ${TOKEN}`);
    expect(byName.customers).toHaveLength(ADMIN_SEARCH_GROUP_LIMIT);
    expect(JSON.stringify(byName)).not.toContain("passwordHash");
    expect(JSON.stringify(byName)).not.toContain("secret-hash");
    expect(Object.keys(byName.customers[0]).sort()).toEqual([
      "displayName",
      "href",
      "id",
      "phone",
    ]);

    const byPhone = await searchAdmin("+84977191903");
    expect(byPhone.customers).toEqual([
      {
        id: ACCOUNT_IDS[3],
        displayName: `Khách ${TOKEN} 3`,
        phone: "0977191903",
        href: "/admin/orders?q=0977191903",
      },
    ]);
  });
});

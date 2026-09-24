import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { listCustomers } from "@/server/admin/list-customers";
import { listDebts, summarizeOpenDebts } from "@/server/admin/list-debts";
import { buildOrdersWhere, listOrders } from "@/server/admin/list-orders";
import { listProducts } from "@/server/admin/list-products";
import { paginate, parsePageParam } from "@/server/admin/pagination";
import { prisma } from "@/server/db/prisma";

const TOKEN = "t7pagtoken";

async function resetOrders() {
  await prisma.stockMovement.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.guestOrderAccess.deleteMany();
  await prisma.checkoutIdempotency.deleteMany();
  await prisma.order.deleteMany();
}

beforeEach(async () => {
  await resetOrders();
  await prisma.product.deleteMany({
    where: { searchText: { contains: TOKEN } },
  });
  await prisma.customerAccount.deleteMany({
    where: { displayName: { contains: TOKEN } },
  });
  await prisma.customer.deleteMany({
    where: { name: { contains: TOKEN } },
  });
});

afterAll(async () => {
  await resetOrders();
  await prisma.product.deleteMany({
    where: { searchText: { contains: TOKEN } },
  });
  await prisma.customerAccount.deleteMany({
    where: { displayName: { contains: TOKEN } },
  });
  await prisma.customer.deleteMany({
    where: { name: { contains: TOKEN } },
  });
});

describe("parsePageParam", () => {
  it("tra ve trang 1 cho gia tri rong, am, khong phai so", () => {
    expect(parsePageParam(undefined)).toBe(1);
    expect(parsePageParam("")).toBe(1);
    expect(parsePageParam("0")).toBe(1);
    expect(parsePageParam("-3")).toBe(1);
    expect(parsePageParam("abc")).toBe(1);
    expect(parsePageParam(["4", "5"])).toBe(4);
    expect(parsePageParam("3")).toBe(3);
  });
});

describe("paginate", () => {
  it("tinh skip/take theo trang va chay count song song voi findMany", async () => {
    const find = vi.fn(async ({ skip, take }: { skip: number; take: number }) =>
      Array.from(
        { length: Math.max(0, Math.min(take, 120 - skip)) },
        (_, i) => skip + i,
      ),
    );
    const count = vi.fn(async () => 120);

    const result = await paginate({ page: 3, pageSize: 50 }, count, find);

    expect(find).toHaveBeenCalledWith({ skip: 100, take: 50 });
    expect(count).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      items: Array.from({ length: 20 }, (_, i) => 100 + i),
      total: 120,
      page: 3,
      pageSize: 50,
    });
  });

  it("trang vuot qua tong so trang thi lui ve trang cuoi", async () => {
    const find = vi.fn(async ({ skip, take }: { skip: number; take: number }) =>
      Array.from(
        { length: Math.max(0, Math.min(take, 60 - skip)) },
        (_, i) => skip + i,
      ),
    );

    const result = await paginate(
      { page: 9, pageSize: 50 },
      async () => 60,
      find,
    );

    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(10);
    expect(find).toHaveBeenLastCalledWith({ skip: 50, take: 50 });
  });

  it("khong co dong nao thi tra ve trang 1 rong", async () => {
    const result = await paginate(
      { page: 4, pageSize: 20 },
      async () => 0,
      async () => [],
    );
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });
});

describe("buildOrdersWhere — quy tac tim kiem", () => {
  it("ma don dang DH + so thi tim chinh xac theo code", () => {
    expect(buildOrdersWhere({ q: "DH0012" })).toEqual({ code: "DH0012" });
    expect(buildOrdersWhere({ q: " dh0012 " })).toEqual({ code: "DH0012" });
  });

  it("toan chu so thi tim contactPhone hoac sdt khach hang lien ket bat dau bang q", () => {
    expect(buildOrdersWhere({ q: "0988777" })).toEqual({
      OR: [
        { contactPhone: { startsWith: "0988777" } },
        { customer: { is: { phone: { startsWith: "0988777" } } } },
      ],
    });
  });

  it("q dang +84… thi cung khop dang 0… tuong ung", () => {
    expect(buildOrdersWhere({ q: "+84988777666" })).toEqual({
      OR: [
        { contactPhone: { startsWith: "+84988777666" } },
        { customer: { is: { phone: { startsWith: "+84988777666" } } } },
        { contactPhone: { startsWith: "0988777666" } },
        { customer: { is: { phone: { startsWith: "0988777666" } } } },
      ],
    });
  });

  it("con lai thi contains tren contactName, code va ten khach hang lien ket", () => {
    expect(buildOrdersWhere({ q: "Trần Khách" })).toEqual({
      OR: [
        { contactName: { contains: "Trần Khách" } },
        { code: { contains: "Trần Khách" } },
        { customer: { is: { name: { contains: "Trần Khách" } } } },
      ],
    });
  });

  it("giu nguyen bo loc kenh, trang thai, ngay", () => {
    const where = buildOrdersWhere({
      status: "paid",
      channel: "pos",
      from: "2026-09-01",
    });
    expect(where).toMatchObject({ status: "paid", channel: "pos" });
    expect(where.createdAt).toBeDefined();
  });
});

describe("listProducts", () => {
  async function seedProducts(count: number) {
    await prisma.product.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        name: `Đường ${TOKEN} ${String(index).padStart(3, "0")}`,
        price: 1000 + index,
        stock: index % 10,
        searchText: `duong ${TOKEN} ${index}`,
      })),
    });
  }

  it("phan trang 50/trang va tim theo searchText da chuan hoa", async () => {
    await seedProducts(55);

    const first = await listProducts({ page: 1, q: `ĐƯỜNG ${TOKEN}` });
    expect(first.pageSize).toBe(50);
    expect(first.total).toBe(55);
    expect(first.items).toHaveLength(50);
    expect(first.page).toBe(1);

    const second = await listProducts({ page: 2, q: `đường ${TOKEN}` });
    expect(second.items).toHaveLength(5);
    expect(second.items[0]?.name).toBe(`Đường ${TOKEN} 050`);
  });

  it("dem nhom ton kho theo count, khong phu thuoc trang hien tai", async () => {
    await seedProducts(20);
    await prisma.product.create({
      data: {
        name: `Âm ${TOKEN}`,
        price: 1000,
        stock: -2,
        searchText: `am ${TOKEN}`,
      },
    });

    const result = await listProducts({
      page: 1,
      pageSize: 5,
      q: TOKEN,
      filters: { status: "low" },
    });

    // stock 0..9 lap lai 2 lan => <=5: 12 dong, +1 am kho
    expect(result.counts).toEqual({
      all: 21,
      low: 13,
      out: 2,
      negative: 1,
      available: 8,
    });
    expect(result.total).toBe(13);
    expect(result.items).toHaveLength(5);
    expect(result.items.every((item) => item.stock <= 5)).toBe(true);
  });

  it("chi select cot can cho trang san pham", async () => {
    await seedProducts(1);
    const result = await listProducts({ page: 1, q: TOKEN });
    expect(Object.keys(result.items[0] ?? {}).sort()).toEqual(
      [
        "aliases",
        "category",
        "categoryId",
        "costPrice",
        "id",
        "imageUrl",
        "name",
        "price",
        "sku",
        "stock",
        "unit",
      ].sort(),
    );
  });
});

describe("listCustomers", () => {
  it("phan trang, giu _count don va KHONG bao gio select passwordHash", async () => {
    await prisma.customerAccount.createMany({
      data: Array.from({ length: 3 }, (_, index) => ({
        phoneNormalized: `+8490077700${index}`,
        displayName: `Khách ${TOKEN} ${index}`,
        passwordHash: "secret-hash",
      })),
    });

    const spy = vi.spyOn(prisma.customerAccount, "findMany");
    const result = await listCustomers({ page: 1, pageSize: 2, q: TOKEN });

    expect(result.total).toBe(3);
    expect(result.items).toHaveLength(2);
    expect(result.pageSize).toBe(2);
    for (const item of result.items) {
      expect(item).not.toHaveProperty("passwordHash");
      expect(item._count.orders).toBe(0);
    }
    const args = spy.mock.calls[0]?.[0];
    expect(args?.select).toBeDefined();
    expect(args?.select).not.toHaveProperty("passwordHash");
    expect(args?.take).toBe(2);
    spy.mockRestore();

    expect((await listCustomers({ page: 1, q: TOKEN })).pageSize).toBe(50);
  });
});

describe("listOrders", () => {
  it("phan trang don va tim theo ma chinh xac", async () => {
    for (let index = 1; index <= 25; index += 1) {
      await prisma.order.create({
        data: {
          code: `DH9${String(index).padStart(3, "0")}`,
          clientId: `t7-order-${index}`,
          total: 1000,
          subtotal: 1000,
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
        },
      });
    }

    const page2 = await listOrders({ page: 2 });
    expect(page2.total).toBe(25);
    expect(page2.pageSize).toBe(20);
    expect(page2.items).toHaveLength(5);
    // moi nhat truoc => trang 2 la 5 don cu nhat
    expect(page2.items[0]?.code).toBe("DH9005");

    const exact = await listOrders({ page: 1, q: "DH9001" });
    expect(exact.items.map((order) => order.code)).toEqual(["DH9001"]);
  });

  it("bỏ qua bộ lọc ngày không hợp lệ thay vì gây crash truy vấn", async () => {
    const where = buildOrdersWhere({ from: "invalid-date", to: "not-a-date" });
    expect(where.createdAt).toBeUndefined();

    // Khong gay loi khi goi listOrders voi query param tu nguoi dung nhu ?from=bad
    await expect(
      listOrders({ filters: { from: "bad", to: "xyz" } }),
    ).resolves.toBeDefined();
  });
});

describe("listDebts", () => {
  it("phan trang 50/trang nhung tong no theo khach van tinh tren toan bo", async () => {
    const customer = await prisma.customer.create({
      data: { name: `Bà Lan ${TOKEN}` },
    });
    for (let index = 0; index < 52; index += 1) {
      await prisma.order.create({
        data: {
          code: `NO${index}`,
          clientId: `t7-debt-${index}`,
          status: "debt",
          total: 10_000,
          subtotal: 10_000,
          customerId: customer.id,
          createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)),
          payments: {
            create: [
              { method: "debt", amount: 10_000 },
              ...(index === 0
                ? [{ method: "cash", amount: 4_000, receivedAt: new Date() }]
                : []),
            ],
          },
        },
      });
    }

    const page1 = await listDebts({ page: 1 });
    expect(page1.pageSize).toBe(50);
    expect(page1.total).toBe(52);
    expect(page1.items).toHaveLength(50);
    expect(page1.items[0]?.code).toBe("NO0");
    expect(page1.items[0]?.paid).toBe(4_000);
    expect(page1.items[0]?.balance).toBe(6_000);

    const page2 = await listDebts({ page: 2 });
    expect(page2.items).toHaveLength(2);

    const summary = await summarizeOpenDebts();
    expect(summary).toEqual([
      {
        key: customer.id,
        name: `Bà Lan ${TOKEN}`,
        balance: 52 * 10_000 - 4_000,
      },
    ]);
  });
});

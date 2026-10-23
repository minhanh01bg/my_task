import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  deleteCategoryAction,
  moveCategoryAction,
  saveCategoryAction,
} from "@/app/(management)/admin/categories/actions";
import { toggleCustomerAccountAction } from "@/app/(management)/admin/customers/actions";
import { recordDebtPaymentAction } from "@/app/(management)/admin/debts/actions";
import {
  cancelOrderAction,
  markOnlineOrderPaidAction,
  transitionOnlineOrderAction,
} from "@/app/(management)/admin/orders/actions";
import {
  deleteProductAction,
  quickUpdateProductAction,
  saveProductAction,
} from "@/app/(management)/admin/products/actions";
import {
  deletePromotionAction,
  savePromotionAction,
  togglePromotionActiveAction,
} from "@/app/(management)/admin/promotions/actions";
import {
  deleteVoucherAction,
  toggleVoucherActiveAction,
} from "@/app/(management)/admin/promotions/vouchers/actions";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import { revalidatePublic } from "@/server/cache/public-cache";
import { prisma } from "@/server/db/prisma";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/server/cache/public-cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/cache/public-cache")>()),
  revalidatePublic: vi.fn(),
}));

const INVALID = { ok: false, message: "Dữ liệu không hợp lệ" };
const PREFIX = "api14-";

async function cleanup() {
  await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.category.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.storefrontPromotion.deleteMany({
    where: { title: { startsWith: PREFIX } },
  });
  await prisma.voucher.deleteMany({ where: { code: { startsWith: "API14" } } });
  await prisma.customerAccount.deleteMany({
    where: { displayName: { startsWith: PREFIX } },
  });
}

beforeEach(async () => {
  await cleanup();
  vi.mocked(revalidatePublic).mockClear();
  vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
    authorized: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(cleanup);

describe("server action sản phẩm (API-14)", () => {
  it("xoá: id sai kiểu hoặc rỗng trả lỗi, không ném", async () => {
    expect(await deleteProductAction("")).toEqual(INVALID);
    expect(await deleteProductAction(42 as unknown as string)).toEqual(INVALID);
  });

  it("xoá: id không tồn tại trả { ok: false } và không làm mới cache", async () => {
    expect(await deleteProductAction(`${PREFIX}khong-co`)).toEqual({
      ok: false,
      message: "Không tìm thấy sản phẩm",
    });
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("xoá thành công trả { ok: true } rồi mới làm mới cache", async () => {
    const product = await prisma.product.create({
      data: { name: `${PREFIX}sp`, price: 1000 },
    });

    expect(await deleteProductAction(product.id)).toEqual({ ok: true });

    const row = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(row.deletedAt).not.toBeNull();
    expect(revalidatePublic).toHaveBeenCalledWith(
      "catalog",
      `product:${product.id}`,
    );
  });

  it("sửa nhanh sản phẩm không tồn tại trả { ok: false }", async () => {
    const formData = new FormData();
    formData.set("id", `${PREFIX}khong-co`);
    formData.set("price", "1000");
    formData.set("stock", "1");
    formData.set("originalStock", "1");

    expect(await quickUpdateProductAction(formData)).toEqual({
      ok: false,
      message: "Không tìm thấy sản phẩm",
    });
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("sửa nhanh giá vượt cột Int trả { ok: false }, không ghi", async () => {
    const product = await prisma.product.create({
      data: { name: `${PREFIX}gia`, price: 1000 },
    });
    const formData = new FormData();
    formData.set("id", product.id);
    formData.set("price", "2147483648");
    formData.set("stock", "1");

    expect(await quickUpdateProductAction(formData)).toEqual({
      ok: false,
      message: "Giá bán quá lớn",
    });
    const row = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
    });
    expect(row.price).toBe(1000);
  });

  it.each([
    ["price", "Giá bán quá lớn"],
    ["costPrice", "Giá vốn quá lớn"],
  ])(
    "lưu sản phẩm với %s vượt cột Int trả { ok: false }, không ghi",
    async (field, message) => {
      const formData = new FormData();
      formData.set("name", `${PREFIX}luu-gia`);
      formData.set("unit", "cái");
      formData.set("price", "1000");
      formData.set("costPrice", "500");
      formData.set("stock", "1");
      formData.set(field, "2147483648");

      expect(await saveProductAction(formData)).toEqual({
        ok: false,
        message,
      });
      expect(
        await prisma.product.count({ where: { name: `${PREFIX}luu-gia` } }),
      ).toBe(0);
    },
  );
});

describe("server action công nợ", () => {
  it("thu nợ vượt cột Int trả { ok: false } trước khi đọc đơn", async () => {
    const formData = new FormData();
    formData.set("orderId", `${PREFIX}don-no`);
    formData.set("amount", "2147483648");
    formData.set("method", "cash");

    expect(await recordDebtPaymentAction(formData)).toEqual({
      ok: false,
      message: "Số tiền quá lớn",
    });
  });
});

describe("server action danh mục (API-14)", () => {
  async function seedCategories() {
    const first = await prisma.category.create({
      data: { name: `${PREFIX}a`, sortOrder: -2 },
    });
    const second = await prisma.category.create({
      data: { name: `${PREFIX}b`, sortOrder: -1 },
    });
    return { first, second };
  }

  it("di chuyển: hướng không thuộc up/down bị từ chối, không đổi thứ tự", async () => {
    const { first, second } = await seedCategories();

    expect(
      await moveCategoryAction(second.id, "sideways" as unknown as "up"),
    ).toEqual(INVALID);
    expect(await moveCategoryAction("", "up")).toEqual(INVALID);

    const rows = await prisma.category.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });
    expect(rows.map((row) => row.id)).toEqual([first.id, second.id]);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("di chuyển: danh mục không tồn tại trả { ok: false }", async () => {
    expect(await moveCategoryAction(`${PREFIX}khong-co`, "up")).toEqual({
      ok: false,
      message: "Không tìm thấy danh mục.",
    });
  });

  it("di chuyển hợp lệ trả { ok: true } và đổi thứ tự", async () => {
    const { first, second } = await seedCategories();

    expect(await moveCategoryAction(second.id, "up")).toEqual({ ok: true });

    const [a, b] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { id: first.id } }),
      prisma.category.findUniqueOrThrow({ where: { id: second.id } }),
    ]);
    expect(b.sortOrder).toBeLessThan(a.sortOrder);
    expect(revalidatePublic).toHaveBeenCalledWith("catalog");
  });

  it("xoá: id sai hoặc không tồn tại trả { ok: false }", async () => {
    expect(await deleteCategoryAction({} as unknown as string)).toEqual(
      INVALID,
    );
    expect(await deleteCategoryAction(`${PREFIX}khong-co`)).toEqual({
      ok: false,
      message: "Không tìm thấy danh mục.",
    });
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("xoá thành công trả { ok: true }", async () => {
    const { first } = await seedCategories();

    expect(await deleteCategoryAction(first.id)).toEqual({ ok: true });
    expect(
      await prisma.category.findUnique({ where: { id: first.id } }),
    ).toBeNull();
  });

  it("lưu danh mục với id không tồn tại trả { ok: false }", async () => {
    const formData = new FormData();
    formData.set("id", `${PREFIX}khong-co`);
    formData.set("name", `${PREFIX}moi`);

    expect(await saveCategoryAction(formData)).toEqual({
      ok: false,
      error: "Không tìm thấy danh mục.",
    });
  });
});

describe("server action khuyến mãi (API-14)", () => {
  const NOT_FOUND = {
    ok: false,
    error: "Không tìm thấy chiến dịch khuyến mãi",
  };

  it("bật/tắt: tham số sai kiểu bị từ chối, không ghi", async () => {
    const promo = await prisma.storefrontPromotion.create({
      data: { title: `${PREFIX}km`, isActive: true },
    });

    expect(
      await togglePromotionActiveAction(
        promo.id,
        "false" as unknown as boolean,
      ),
    ).toMatchObject({ ok: false });
    expect(await togglePromotionActiveAction("", false)).toMatchObject({
      ok: false,
    });

    const row = await prisma.storefrontPromotion.findUniqueOrThrow({
      where: { id: promo.id },
    });
    expect(row.isActive).toBe(true);
  });

  it("bật/tắt, xoá, lưu với id không tồn tại trả { ok: false } thay vì 500", async () => {
    const missing = `${PREFIX}khong-co`;
    expect(await togglePromotionActiveAction(missing, false)).toEqual(
      NOT_FOUND,
    );
    expect(await deletePromotionAction(missing)).toEqual(NOT_FOUND);

    const formData = new FormData();
    formData.set("id", missing);
    formData.set("title", `${PREFIX}km`);
    expect(await savePromotionAction(null, formData)).toEqual(NOT_FOUND);

    expect(revalidatePublic).not.toHaveBeenCalled();
    expect(
      await prisma.adminAuditEvent.count({ where: { entityId: missing } }),
    ).toBe(0);
  });
});

describe("server action mã giảm giá (API-14)", () => {
  it("bật/tắt và xoá: tham số sai kiểu bị từ chối, không ghi", async () => {
    const voucher = await prisma.voucher.create({
      data: { code: "API14TOGGLE", type: "fixed", value: 1000 },
    });

    expect(
      await toggleVoucherActiveAction(voucher.id, "no" as unknown as boolean),
    ).toMatchObject({ ok: false });
    expect(await toggleVoucherActiveAction("", false)).toMatchObject({
      ok: false,
    });
    expect(await deleteVoucherAction(7 as unknown as string)).toMatchObject({
      ok: false,
    });

    const row = await prisma.voucher.findUniqueOrThrow({
      where: { id: voucher.id },
    });
    expect(row.isActive).toBe(true);
  });
});

describe("server action tài khoản khách (API-14)", () => {
  it("khoá/mở khoá trả kết quả { ok } thay vì void", async () => {
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "0909000014",
        displayName: `${PREFIX}khach`,
        passwordHash: "x",
      },
    });

    expect(await toggleCustomerAccountAction("")).toEqual(INVALID);
    expect(await toggleCustomerAccountAction(`${PREFIX}khong-co`)).toEqual({
      ok: false,
      message: "Không tìm thấy tài khoản",
    });
    expect(await toggleCustomerAccountAction(account.id)).toEqual({
      ok: true,
      disabled: true,
    });
    expect(await toggleCustomerAccountAction(account.id)).toEqual({
      ok: true,
      disabled: false,
    });
  });
});

describe("server action đơn hàng (API-14)", () => {
  it("id hoặc trạng thái sai trả { ok: false } thay vì ném", async () => {
    await expect(cancelOrderAction("   ")).resolves.toEqual(INVALID);
    await expect(markOnlineOrderPaidAction("")).resolves.toEqual(INVALID);
    await expect(
      transitionOnlineOrderAction(`${PREFIX}don`, "bogus"),
    ).resolves.toEqual({ ok: false, message: "Trạng thái không hợp lệ" });
  });

  it("lỗi nghiệp vụ (đơn không tồn tại) trả thông báo thay vì 500", async () => {
    const missing = { ok: false, message: "Không tìm thấy đơn online" };
    await expect(
      transitionOnlineOrderAction(`${PREFIX}don`, "confirmed"),
    ).resolves.toEqual(missing);
    await expect(markOnlineOrderPaidAction(`${PREFIX}don`)).resolves.toEqual(
      missing,
    );
  });
});

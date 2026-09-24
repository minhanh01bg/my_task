import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteVoucherAction,
  saveVoucherAction,
  toggleVoucherActiveAction,
} from "@/app/admin/promotions/vouchers/actions";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";
import {
  createVoucher,
  deleteVoucher,
  listVouchers,
  toggleVoucher,
  updateVoucher,
} from "@/server/vouchers/admin-vouchers";
import { findVoucherByCode } from "@/server/vouchers/get-voucher";
import { voucherInputSchema, type VoucherInput } from "@/types/voucher";

function input(overrides: Record<string, unknown> = {}): VoucherInput {
  return voucherInputSchema.parse({
    code: "giam10",
    type: "percent",
    value: 10,
    maxDiscount: 30_000,
    minOrderTotal: 0,
    isActive: true,
    ...overrides,
  });
}

async function auditFor(entityId: string) {
  return prisma.adminAuditEvent.findMany({
    where: { entityType: "voucher", entityId },
    orderBy: { createdAt: "asc" },
  });
}

beforeEach(async () => {
  await prisma.order.deleteMany({
    // Cac file chay noi tiep tren cung DB: lich su voucher la mot phan fixture.
    where: { voucherCode: { not: null } },
  });
  await prisma.voucher.deleteMany();
  await prisma.adminAuditEvent.deleteMany({ where: { entityType: "voucher" } });
  vi.restoreAllMocks();
});

describe("voucherInputSchema", () => {
  it("chuẩn hoá mã và đổi ngày theo giờ Việt Nam", () => {
    const parsed = input({
      code: "  freeShip ",
      type: "freeship",
      value: 99,
      startsAt: "2026-09-01",
      endsAt: "2026-09-30",
    });
    expect(parsed.code).toBe("FREESHIP");
    expect(parsed.value).toBe(0);
    expect(parsed.startsAt?.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(parsed.endsAt?.toISOString()).toBe("2026-09-30T16:59:59.999Z");
  });

  it("từ chối phần trăm ngoài 1-100, mã sai định dạng, ngày ngược", () => {
    expect(
      voucherInputSchema.safeParse({ code: "ABC", type: "percent", value: 120 })
        .success,
    ).toBe(false);
    expect(
      voucherInputSchema.safeParse({ code: "có dấu", type: "fixed", value: 1 })
        .success,
    ).toBe(false);
    expect(
      voucherInputSchema.safeParse({
        code: "ABC",
        type: "fixed",
        value: 10_000,
        startsAt: "2026-09-10",
        endsAt: "2026-09-01",
      }).success,
    ).toBe(false);
  });
});

describe("admin-vouchers", () => {
  async function history(code: string, status = "pending") {
    return prisma.order.create({
      data: {
        code: `voucher-history-${code}`,
        clientId: `voucher-history-${code}`,
        voucherCode: code,
        status,
      },
    });
  }

  it.each(["pending", "cancelled"])(
    "giữ mã và voucher có đơn lịch sử %s kể cả usedCount bằng 0",
    async (status) => {
      const created = await createVoucher(input(), {});
      if (!created.ok) throw new Error("create failed");
      const id = created.voucherId!;
      await history("GIAM10", status);
      expect((await updateVoucher(id, input({ code: "GIAM20" }), {})).ok).toBe(
        false,
      );
      expect((await deleteVoucher(id, {})).ok).toBe(false);
      expect(await prisma.voucher.findUnique({ where: { id } })).toMatchObject({
        code: "GIAM10",
        usedCount: 0,
      });
      expect((await updateVoucher(id, input({ value: 15 }), {})).ok).toBe(true);
      expect((await toggleVoucher(id, false, {})).ok).toBe(true);
    },
  );

  it("không tái dùng mã lịch sử đã mất voucher khi tạo hoặc đổi mã", async () => {
    await history("OLD", "cancelled");
    expect((await createVoucher(input({ code: "OLD" }), {})).ok).toBe(false);
    const created = await createVoucher(input(), {});
    if (!created.ok) throw new Error("create failed");
    expect(
      (await updateVoucher(created.voucherId!, input({ code: "OLD" }), {})).ok,
    ).toBe(false);
    expect(
      await prisma.voucher.findUnique({ where: { code: "OLD" } }),
    ).toBeNull();
    expect(
      (await updateVoucher(created.voucherId!, input({ code: "NEW" }), {})).ok,
    ).toBe(true);
  });

  it("tạo voucher kèm audit event và tìm được theo mã", async () => {
    const result = await createVoucher(input(), {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const rule = await findVoucherByCode(" giam10 ");
    expect(rule).toMatchObject({ code: "GIAM10", type: "percent", value: 10 });

    const audit = await auditFor(result.voucherId!);
    expect(audit.map((event) => event.action)).toEqual(["voucher.create"]);
  });

  it("từ chối mã trùng", async () => {
    await createVoucher(input(), {});
    const duplicate = await createVoucher(input({ code: "GIAM10" }), {});
    expect(duplicate).toEqual({
      ok: false,
      error: "Mã giảm giá đã tồn tại",
    });
  });

  it("cập nhật, bật/tắt và xoá đều ghi audit", async () => {
    const created = await createVoucher(input(), {});
    if (!created.ok) throw new Error("create failed");
    const id = created.voucherId!;

    const updated = await updateVoucher(
      id,
      input({ value: 15, maxUses: 100 }),
      {},
    );
    expect(updated.ok).toBe(true);
    expect(await prisma.voucher.findUnique({ where: { id } })).toMatchObject({
      value: 15,
      maxUses: 100,
    });

    expect((await toggleVoucher(id, false, {})).ok).toBe(true);
    expect((await prisma.voucher.findUnique({ where: { id } }))?.isActive).toBe(
      false,
    );

    expect((await deleteVoucher(id, {})).ok).toBe(true);
    expect(await prisma.voucher.findUnique({ where: { id } })).toBeNull();

    const audit = await auditFor(id);
    expect(audit.map((event) => event.action)).toEqual([
      "voucher.create",
      "voucher.update",
      "voucher.toggle",
      "voucher.delete",
    ]);
  });

  it("không cho đặt maxUses nhỏ hơn số lượt đã dùng", async () => {
    const voucher = await prisma.voucher.create({
      data: { code: "USED", type: "fixed", value: 10_000, usedCount: 5 },
    });
    const result = await updateVoucher(
      voucher.id,
      input({ code: "USED", type: "fixed", value: 10_000, maxUses: 3 }),
      {},
    );
    expect(result.ok).toBe(false);
    expect(
      (await prisma.voucher.findUnique({ where: { id: voucher.id } }))?.maxUses,
    ).toBeNull();
  });

  it("báo lỗi thân thiện khi voucher không tồn tại", async () => {
    expect((await toggleVoucher("missing", true, {})).ok).toBe(false);
    expect((await deleteVoucher("missing", {})).ok).toBe(false);
    expect((await updateVoucher("missing", input(), {})).ok).toBe(false);
  });

  it("liệt kê có phân trang, mới nhất trước", async () => {
    for (const [index, code] of ["AAA", "BBB", "CCC"].entries()) {
      await prisma.voucher.create({
        data: {
          code,
          type: "fixed",
          value: 1_000,
          createdAt: new Date(Date.UTC(2026, 8, 1 + index)),
        },
      });
    }
    const page = await listVouchers({ page: 1, pageSize: 2 });
    expect(page.total).toBe(3);
    expect(page.items.map((voucher) => voucher.code)).toEqual(["CCC", "BBB"]);
  });
});

describe("voucher server actions", () => {
  it("từ chối khi chưa đăng nhập admin", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockRejectedValueOnce(
      new requireAdminModule.AdminUnauthorizedError(),
    );
    const formData = new FormData();
    formData.set("code", "ABC");
    await expect(saveVoucherAction(null, formData)).rejects.toThrow(
      requireAdminModule.AdminUnauthorizedError,
    );
  });

  describe("với quyền admin", () => {
    beforeEach(async () => {
      const admin =
        (await prisma.adminIdentity.findFirst()) ??
        (await prisma.adminIdentity.create({
          data: { username: "admin_voucher_test", passwordHash: "x" },
        }));
      vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
        authorized: true,
        identity: {
          id: admin.id,
          username: admin.username,
          role: "admin",
          version: 1,
        },
      });
    });

    it("tạo, sửa, bật/tắt, xoá qua FormData", async () => {
      const formData = new FormData();
      formData.set("code", "freeship");
      formData.set("type", "freeship");
      formData.set("minOrderTotal", "200000");
      formData.set("maxUses", "");
      formData.set("startsAt", "");
      formData.set("isActive", "true");

      const created = await saveVoucherAction(null, formData);
      expect(created.ok).toBe(true);
      const row = await prisma.voucher.findUniqueOrThrow({
        where: { code: "FREESHIP" },
      });
      expect(row).toMatchObject({
        type: "freeship",
        minOrderTotal: 200_000,
        maxUses: null,
        isActive: true,
      });
      const audit = await auditFor(row.id);
      expect(audit[0]?.identityId).toBeTruthy();

      formData.set("id", row.id);
      formData.set("minOrderTotal", "150000");
      formData.set("isActive", "false");
      expect((await saveVoucherAction(null, formData)).ok).toBe(true);
      expect(
        await prisma.voucher.findUnique({ where: { id: row.id } }),
      ).toMatchObject({ minOrderTotal: 150_000, isActive: false });

      expect((await toggleVoucherActiveAction(row.id, true)).ok).toBe(true);
      expect((await deleteVoucherAction(row.id)).ok).toBe(true);
      expect(await prisma.voucher.count()).toBe(0);
    });

    it("trả lỗi tiếng Việt khi dữ liệu sai", async () => {
      const formData = new FormData();
      formData.set("code", "AB");
      formData.set("type", "percent");
      formData.set("value", "10");
      const result = await saveVoucherAction(null, formData);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/Mã gồm/);
    });
  });
});

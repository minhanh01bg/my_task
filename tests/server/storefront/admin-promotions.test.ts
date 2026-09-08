import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db/prisma";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import {
  deletePromotionAction,
  savePromotionAction,
  togglePromotionActiveAction,
} from "@/app/admin/promotions/actions";
import { promotionActionSchema } from "@/types/storefront";

describe("Admin Promotion Management Actions", () => {
  beforeEach(async () => {
    await prisma.storefrontPromotion.deleteMany();
    await prisma.adminAuditEvent.deleteMany({
      where: { entityType: "promotion" },
    });
    vi.restoreAllMocks();
  });

  it("từ chối gọi action khi chưa đăng nhập admin", async () => {
    vi.spyOn(requireAdminModule, "requireAdminSession").mockRejectedValueOnce(
      new requireAdminModule.AdminUnauthorizedError(),
    );

    const formData = new FormData();
    formData.set("title", "Khuyến Mãi Mới");

    await expect(savePromotionAction(null, formData)).rejects.toThrow(
      requireAdminModule.AdminUnauthorizedError,
    );
  });

  describe("promotionActionSchema validation", () => {
    it("chấp nhận input hợp lệ", () => {
      const valid = {
        title: "Ưu đãi mùa hè",
        body: "Giảm 10% đơn hàng",
        ctaLabel: "Mua ngay",
        ctaHref: "/shop#catalog",
        placement: "announcement",
        startsAt: "2026-09-01T00:00:00Z",
        endsAt: "2026-09-30T23:59:59Z",
        priority: 10,
        isActive: true,
      };

      const parsed = promotionActionSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("từ chối liên kết CTA không an toàn (javascript:, http không bảo mật)", () => {
      expect(
        promotionActionSchema.safeParse({
          title: "Test",
          ctaHref: "javascript:alert(1)",
        }).success,
      ).toBe(false);

      expect(
        promotionActionSchema.safeParse({
          title: "Test",
          ctaHref: "http://insecure.example.com",
        }).success,
      ).toBe(false);
    });

    it("từ chối khi ngày kết thúc trước ngày bắt đầu", () => {
      expect(
        promotionActionSchema.safeParse({
          title: "Lỗi thời gian",
          startsAt: "2026-09-10T00:00:00Z",
          endsAt: "2026-09-05T00:00:00Z",
        }).success,
      ).toBe(false);
    });

    it("từ chối tiêu đề rỗng hoặc quá dài", () => {
      expect(
        promotionActionSchema.safeParse({
          title: "",
        }).success,
      ).toBe(false);

      expect(
        promotionActionSchema.safeParse({
          title: "a".repeat(201),
        }).success,
      ).toBe(false);
    });
  });

  describe("Thao tác CRUD với quyền admin", () => {
    beforeEach(async () => {
      let admin = await prisma.adminIdentity.findFirst();
      if (!admin) {
        admin = await prisma.adminIdentity.create({
          data: {
            username: "admin_test",
            passwordHash: "dummy_hash",
          },
        });
      }
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

    it("tạo mới và chỉnh sửa chiến dịch thành công kèm audit log", async () => {
      const createData = new FormData();
      createData.set("title", "Chiến dịch Tết");
      createData.set("body", "Nhận quà hấp dẫn");
      createData.set("placement", "hero");
      createData.set("priority", "15");
      createData.set("isActive", "true");

      const createResult = await savePromotionAction(null, createData);
      expect(createResult.ok).toBe(true);

      const created = await prisma.storefrontPromotion.findFirst({
        where: { title: "Chiến dịch Tết" },
      });
      expect(created).toBeDefined();
      expect(created?.priority).toBe(15);
      expect(created?.placement).toBe("hero");

      // Kiểm tra audit log
      const audit = await prisma.adminAuditEvent.findFirst({
        where: { entityType: "promotion", entityId: created!.id },
      });
      expect(audit).toBeDefined();
      expect(audit?.action).toBe("promotion.create");

      // Chỉnh sửa
      const updateData = new FormData();
      updateData.set("id", created!.id);
      updateData.set("title", "Chiến dịch Tết - Cập nhật");
      updateData.set("placement", "hero");
      updateData.set("priority", "20");
      updateData.set("isActive", "true");

      const updateResult = await savePromotionAction(null, updateData);
      expect(updateResult.ok).toBe(true);

      const updated = await prisma.storefrontPromotion.findUnique({
        where: { id: created!.id },
      });
      expect(updated?.title).toBe("Chiến dịch Tết - Cập nhật");
      expect(updated?.priority).toBe(20);
    });

    it("toggle trạng thái active và xóa chiến dịch", async () => {
      const promo = await prisma.storefrontPromotion.create({
        data: {
          title: "Flash Sale",
          placement: "announcement",
          isActive: true,
        },
      });

      // Tắt active
      const toggleResult = await togglePromotionActiveAction(promo.id, false);
      expect(toggleResult.ok).toBe(true);

      let row = await prisma.storefrontPromotion.findUnique({
        where: { id: promo.id },
      });
      expect(row?.isActive).toBe(false);

      // Xóa
      const deleteResult = await deletePromotionAction(promo.id);
      expect(deleteResult.ok).toBe(true);

      row = await prisma.storefrontPromotion.findUnique({
        where: { id: promo.id },
      });
      expect(row).toBeNull();
    });
  });
});

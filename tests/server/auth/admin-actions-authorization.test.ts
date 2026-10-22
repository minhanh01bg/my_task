import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteProductAction,
  quickUpdateProductAction,
  saveProductAction,
} from "@/app/(management)/admin/products/actions";
import {
  deleteCategoryAction,
  moveCategoryAction,
  saveCategoryAction,
} from "@/app/(management)/admin/categories/actions";
import { recordDebtPaymentAction } from "@/app/(management)/admin/debts/actions";
import { POST as uploadProductImage } from "@/app/api/products/images/route";
import { createAdminSession, SESSION_COOKIE } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

const mockCookies = new Map<string, string>();
const UNAUTHORIZED = { ok: false, message: "Yêu cầu quyền quản trị" };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const val = mockCookies.get(name);
      return val ? { name, value: val } : undefined;
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Admin Server Actions and Route Authorization", () => {
  beforeEach(() => {
    mockCookies.clear();
    vi.clearAllMocks();
  });

  describe("Product Actions Authorization", () => {
    it("saveProductAction: từ chối khi chưa đăng nhập", async () => {
      const formData = new FormData();
      formData.set("name", "Sản phẩm test chưa login");
      formData.set("price", "50000");
      formData.set("costPrice", "30000");
      formData.set("stock", "10");
      formData.set("unit", "cái");

      const result = await saveProductAction(formData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("quản trị");
      }
    });

    it("quickUpdateProductAction: từ chối khi chưa đăng nhập", async () => {
      const formData = new FormData();
      formData.set("id", "prod-1");
      formData.set("price", "99000");
      formData.set("stock", "5");

      const result = await quickUpdateProductAction(formData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("quản trị");
      }
    });

    it("deleteProductAction: từ chối khi chưa đăng nhập", async () => {
      expect(await deleteProductAction("prod-1")).toEqual(UNAUTHORIZED);
    });
  });

  describe("Category Actions Authorization", () => {
    it("saveCategoryAction: từ chối khi chưa đăng nhập", async () => {
      const formData = new FormData();
      formData.set("name", "Danh mục test");

      expect(await saveCategoryAction(formData)).toEqual({
        ok: false,
        error: "Yêu cầu quyền quản trị",
      });
    });

    it("deleteCategoryAction: từ chối khi chưa đăng nhập", async () => {
      expect(await deleteCategoryAction("cat-1")).toEqual(UNAUTHORIZED);
    });

    it("moveCategoryAction: từ chối khi chưa đăng nhập", async () => {
      expect(await moveCategoryAction("cat-1", "up")).toEqual(UNAUTHORIZED);
    });
  });

  describe("Debt Actions Authorization", () => {
    it("recordDebtPaymentAction: từ chối khi chưa đăng nhập", async () => {
      const formData = new FormData();
      formData.set("orderId", "order-1");
      formData.set("amount", "100000");
      formData.set("method", "cash");

      const result = await recordDebtPaymentAction(formData);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain("quản trị");
      }
    });
  });

  describe("Product Image Upload API Authorization", () => {
    it("POST /api/products/images: từ chối 401 khi chưa đăng nhập", async () => {
      const formData = new FormData();
      const file = new File(["fake-image-content"], "test.jpg", {
        type: "image/jpeg",
      });
      formData.set("image", file);

      const request = new Request("http://localhost:3000/api/products/images", {
        method: "POST",
        body: formData,
      });

      const response = await uploadProductImage(request);
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.message).toContain("quản trị");
    });
  });

  describe("Authenticated Admin Execution", () => {
    it("saveCategoryAction: thực thi thành công khi có phiên admin hợp lệ", async () => {
      const { token } = await createAdminSession();
      mockCookies.set(SESSION_COOKIE, token);

      const categoryName = `Danh mục bảo mật ${Date.now()}`;
      const formData = new FormData();
      formData.set("name", categoryName);
      formData.set("sortOrder", "99");

      await saveCategoryAction(formData);

      const created = await prisma.category.findFirst({
        where: { name: categoryName },
      });
      expect(created).toBeDefined();
      expect(created?.name).toBe(categoryName);
      expect(created?.slug).toMatch(/^danh-muc-bao-mat-\d+$/);

      // Sửa dù đổi tên vẫn giữ nguyên slug đã có (URL ổn định).
      const keep = new FormData();
      keep.set("id", created!.id);
      keep.set("name", categoryName);
      keep.set("sortOrder", "98");
      await saveCategoryAction(keep);
      const kept = await prisma.category.findUniqueOrThrow({
        where: { id: created!.id },
      });
      expect(kept.slug).toBe(created?.slug);

      const rename = new FormData();
      rename.set("id", created!.id);
      rename.set("name", `Đồ uống ${categoryName}`);
      rename.set("sortOrder", "98");
      await saveCategoryAction(rename);
      const renamed = await prisma.category.findUniqueOrThrow({
        where: { id: created!.id },
      });
      expect(renamed.slug).toBe(created?.slug);
      await prisma.category.delete({ where: { id: created!.id } });
    });
  });
});

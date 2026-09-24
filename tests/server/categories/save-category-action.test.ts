import { beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/server/db/prisma";
import * as requireAdminModule from "@/server/auth/require-admin-session";
import { saveCategoryAction } from "@/app/admin/categories/actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("saveCategoryAction — xử lý khoảng trắng và tên danh mục", () => {
  beforeEach(async () => {
    await prisma.category.deleteMany({
      where: { name: { startsWith: "Test Category" } },
    });
    vi.restoreAllMocks();
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: "admin-1", username: "admin", role: "admin", version: 1 },
    });
  });

  it("từ chối khi tên danh mục chỉ toàn khoảng trắng", async () => {
    const countBefore = await prisma.category.count();

    const formData = new FormData();
    formData.set("name", "    ");
    formData.set("sortOrder", "1");

    await saveCategoryAction(formData);

    const countAfter = await prisma.category.count();
    expect(countAfter).toBe(countBefore);
  });

  it("tự động trim tên danh mục khi lưu", async () => {
    const formData = new FormData();
    formData.set("name", "   Test Category Trimmed   ");
    formData.set("sortOrder", "2");

    await saveCategoryAction(formData);

    const saved = await prisma.category.findFirst({
      where: { name: "Test Category Trimmed" },
    });
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe("Test Category Trimmed");
  });
});

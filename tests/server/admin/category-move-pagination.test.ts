import { beforeEach, expect, it, vi } from "vitest";

import { moveCategoryAction } from "@/app/(management)/admin/categories/actions";
import { listAdminCategories } from "@/server/admin/list-categories";
import { prisma } from "@/server/db/prisma";

vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({}),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

beforeEach(async () => {
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
});
it("moving a tied category across the page boundary uses the displayed neighbor", async () => {
  await prisma.category.createMany({
    data: Array.from({ length: 21 }, (_, i) => ({
      id: `move-category-${String(20 - i).padStart(2, "0")}`,
      name: "Trùng tên",
      sortOrder: 1,
    })),
  });
  const before = await listAdminCategories({ page: 2, pageSize: 20 });
  expect(before.items[0].id).toBe("move-category-20");
  await moveCategoryAction(before.items[0].id, "up");
  const first = await listAdminCategories({ page: 1, pageSize: 20 });
  const second = await listAdminCategories({ page: 2, pageSize: 20 });
  expect(first.items[19].id).toBe("move-category-20");
  expect(second.items[0].id).toBe("move-category-19");
});

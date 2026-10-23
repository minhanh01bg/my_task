import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveCategoryAction } from "@/app/(management)/admin/categories/actions";
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

// AZ-7: id do client gửi lên phải bị giới hạn độ dài trước khi chạm Prisma.
const HUGE_ID = "c".repeat(10 * 1024);

function formOf(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("id danh mục/sản phẩm có giới hạn (AZ-7)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(requireAdminModule, "requireAdminSession").mockResolvedValue({
      authorized: true,
      identity: { id: "admin-1", username: "admin", role: "admin", version: 1 },
    });
  });

  it("saveCategoryAction từ chối id 10 KB và không ghi gì", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const update = vi.spyOn(prisma.category, "update");
    const create = vi.spyOn(prisma.category, "create");

    const result = await saveCategoryAction(
      formOf({ id: HUGE_ID, name: "Danh mục id dài", sortOrder: "1" }),
    );

    expect(result.ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("saveProductAction từ chối id 10 KB và không ghi gì", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const update = vi.spyOn(prisma.product, "update");
    const updateMany = vi.spyOn(prisma.product, "updateMany");
    const create = vi.spyOn(prisma.product, "create");

    const result = await saveProductAction(
      formOf({
        id: HUGE_ID,
        name: "Sản phẩm id dài",
        unit: "cái",
        price: "1000",
        costPrice: "0",
        stock: "1",
        originalStock: "1",
      }),
    );

    expect(result.ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("quickUpdateProductAction từ chối id 10 KB và không ghi gì", async () => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const update = vi.spyOn(prisma.product, "update");
    const updateMany = vi.spyOn(prisma.product, "updateMany");

    const result = await quickUpdateProductAction(
      formOf({ id: HUGE_ID, price: "1000", stock: "1", originalStock: "1" }),
    );

    expect(result.ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });
});

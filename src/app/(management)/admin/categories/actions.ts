"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  categoryNameSchema,
  type SaveCategoryResult,
} from "@/lib/categories/category-form";

import {
  ADMIN_UNAUTHORIZED_MESSAGE,
  adminEntityIdSchema,
  authorizeAdminAction,
  INVALID_INPUT_MESSAGE,
  isRecordNotFound,
} from "@/server/admin/admin-action";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { resolveCategorySlug } from "@/server/categories/category-slug";
import { prisma } from "@/server/db/prisma";
import { retryOnSlugConflict } from "@/server/seo/slug-conflict";
import { buildSearchText } from "@/lib/search/search-text";
import type { AdminActionResult } from "@/types/admin-action";

const CATEGORY_NOT_FOUND = "Không tìm thấy danh mục.";

const schema = z.object({
  id: z.string().optional(),
  name: categoryNameSchema,
  sortOrder: z.coerce.number().int().default(0),
});

const moveSchema = z.object({
  id: adminEntityIdSchema,
  direction: z.enum(["up", "down"]),
});

export async function saveCategoryAction(
  formData: FormData,
): Promise<SaveCategoryResult> {
  if (!(await authorizeAdminAction())) {
    return { ok: false, error: ADMIN_UNAUTHORIZED_MESSAGE };
  }
  const parsed = schema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Vui lòng kiểm tra thông tin danh mục.",
      fieldErrors: { name: parsed.error.flatten().fieldErrors.name?.[0] },
    };
  }

  const { id, ...fields } = parsed.data;
  if (id) {
    const products = await prisma.product.findMany({
      where: { categoryId: id },
      select: { id: true, name: true, aliases: true, sku: true },
    });
    try {
      await retryOnSlugConflict(async () => {
        const slug = await resolveCategorySlug(prisma, {
          id,
          name: fields.name,
        });
        await prisma.$transaction([
          prisma.category.update({ where: { id }, data: { ...fields, slug } }),
          ...products.map((product) =>
            prisma.product.update({
              where: { id: product.id },
              data: {
                searchText: buildSearchText({
                  name: product.name,
                  aliases: product.aliases,
                  sku: product.sku,
                  categoryName: fields.name,
                }),
              },
            }),
          ),
        ]);
      });
    } catch (error) {
      if (isRecordNotFound(error)) {
        return { ok: false, error: CATEGORY_NOT_FOUND };
      }
      throw error;
    }
  } else {
    await retryOnSlugConflict(async () => {
      const slug = await resolveCategorySlug(prisma, { name: fields.name });
      await prisma.category.create({ data: { ...fields, slug } });
    });
  }

  revalidatePublic(CACHE_TAGS.catalog);
  revalidatePath("/admin/categories");
  revalidatePath("/pos");
  return { ok: true, message: id ? "Đã lưu danh mục." : "Đã thêm danh mục." };
}

export async function deleteCategoryAction(
  id: string,
): Promise<AdminActionResult> {
  if (!(await authorizeAdminAction())) {
    return { ok: false, message: ADMIN_UNAUTHORIZED_MESSAGE };
  }
  const parsed = adminEntityIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: INVALID_INPUT_MESSAGE };

  const products = await prisma.product.findMany({
    where: { categoryId: parsed.data },
    select: { id: true, name: true, aliases: true, sku: true },
  });
  try {
    await prisma.$transaction([
      ...products.map((product) =>
        prisma.product.update({
          where: { id: product.id },
          data: {
            categoryId: null,
            searchText: buildSearchText(product),
          },
        }),
      ),
      prisma.category.delete({ where: { id: parsed.data } }),
    ]);
  } catch (error) {
    if (isRecordNotFound(error)) {
      return { ok: false, message: CATEGORY_NOT_FOUND };
    }
    throw error;
  }
  revalidatePublic(CACHE_TAGS.catalog);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/pos");
  return { ok: true };
}

export async function moveCategoryAction(
  id: string,
  direction: "up" | "down",
): Promise<AdminActionResult> {
  if (!(await authorizeAdminAction())) {
    return { ok: false, message: ADMIN_UNAUTHORIZED_MESSAGE };
  }
  const parsed = moveSchema.safeParse({ id, direction });
  if (!parsed.success) return { ok: false, message: INVALID_INPUT_MESSAGE };

  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const index = categories.findIndex(
    (category) => category.id === parsed.data.id,
  );
  if (index < 0) return { ok: false, message: CATEGORY_NOT_FOUND };
  const targetIndex = parsed.data.direction === "up" ? index - 1 : index + 1;
  // Đã ở đầu/cuối danh sách: không có gì để đổi.
  if (targetIndex < 0 || targetIndex >= categories.length) return { ok: true };

  const reordered = [...categories];
  [reordered[index], reordered[targetIndex]] = [
    reordered[targetIndex]!,
    reordered[index]!,
  ];
  await prisma.$transaction(
    reordered.map((category, position) =>
      prisma.category.update({
        where: { id: category.id },
        data: { sortOrder: position + 1 },
      }),
    ),
  );

  revalidatePublic(CACHE_TAGS.catalog);
  revalidatePath("/admin/categories");
  revalidatePath("/pos");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { resolveCategorySlug } from "@/server/categories/category-slug";
import { prisma } from "@/server/db/prisma";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import { retryOnSlugConflict } from "@/server/seo/slug-conflict";
import { buildSearchText } from "@/lib/search/search-text";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().default(0),
});

export async function saveCategoryAction(formData: FormData): Promise<void> {
  await requireAdminSession();
  const parsed = schema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return;

  const { id, ...fields } = parsed.data;
  if (id) {
    const products = await prisma.product.findMany({
      where: { categoryId: id },
      select: { id: true, name: true, aliases: true, sku: true },
    });
    await retryOnSlugConflict(async () => {
      const slug = await resolveCategorySlug(prisma, { id, name: fields.name });
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
  } else {
    await retryOnSlugConflict(async () => {
      const slug = await resolveCategorySlug(prisma, { name: fields.name });
      await prisma.category.create({ data: { ...fields, slug } });
    });
  }

  revalidatePublic(CACHE_TAGS.catalog);
  revalidatePath("/admin/categories");
  revalidatePath("/pos");
}

export async function deleteCategoryAction(id: string): Promise<void> {
  await requireAdminSession();
  const products = await prisma.product.findMany({
    where: { categoryId: id },
    select: { id: true, name: true, aliases: true, sku: true },
  });
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
    prisma.category.delete({ where: { id } }),
  ]);
  revalidatePublic(CACHE_TAGS.catalog);
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

export async function moveCategoryAction(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  await requireAdminSession();
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true },
  });
  const index = categories.findIndex((category) => category.id === id);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) return;

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
}

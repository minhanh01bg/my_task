"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import { buildSearchText } from "@/lib/search/search-text";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().default(0),
});

export async function saveCategoryAction(formData: FormData): Promise<void> {
  const parsed = schema.safeParse({
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) return;

  const { id, ...data } = parsed.data;
  if (id) {
    const products = await prisma.product.findMany({
      where: { categoryId: id },
      select: { id: true, name: true, aliases: true, sku: true },
    });
    await prisma.$transaction([
      prisma.category.update({ where: { id }, data }),
      ...products.map((product) =>
        prisma.product.update({
          where: { id: product.id },
          data: {
            searchText: buildSearchText({
              name: product.name,
              aliases: product.aliases,
              sku: product.sku,
              categoryName: data.name,
            }),
          },
        }),
      ),
    ]);
  } else {
    await prisma.category.create({ data });
  }

  revalidatePath("/admin/categories");
  revalidatePath("/pos");
}

export async function deleteCategoryAction(id: string): Promise<void> {
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
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

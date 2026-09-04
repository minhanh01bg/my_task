"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";

const schema = z.object({
  name: z.string().min(1),
  sortOrder: z.coerce.number().int().default(0),
});

export async function saveCategoryAction(formData: FormData) {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    sortOrder: formData.get("sortOrder"),
  });

  if (!parsed.success) {
    return { ok: false as const, message: "Tên danh mục không được để trống" };
  }

  await prisma.category.create({ data: parsed.data });

  revalidatePath("/admin/categories");
  revalidatePath("/pos");

  return { ok: true as const };
}

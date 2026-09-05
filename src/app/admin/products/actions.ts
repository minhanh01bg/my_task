"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { saveProduct, softDeleteProduct } from "@/server/products/save-product";

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Tên sản phẩm không được để trống"),
  sku: z.string().nullable(),
  categoryId: z.string().nullable(),
  unit: z.string().min(1),
  price: z.coerce.number().int().min(0),
  costPrice: z.coerce.number().int().min(0),
  stock: z.coerce.number(),
  aliases: z.string().nullable(),
  imageUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .url("Ảnh phải là một đường dẫn hợp lệ")
        .refine(
          (value) =>
            value.startsWith("https://") || value.startsWith("http://"),
          "Ảnh phải dùng đường dẫn http hoặc https",
        ),
    ])
    .nullable(),
});

export async function saveProductAction(formData: FormData) {
  const raw = {
    id: (formData.get("id") as string) || undefined,
    name: formData.get("name"),
    sku: (formData.get("sku") as string) || null,
    categoryId: (formData.get("categoryId") as string) || null,
    unit: formData.get("unit"),
    price: formData.get("price"),
    costPrice: formData.get("costPrice"),
    stock: formData.get("stock"),
    aliases: (formData.get("aliases") as string) || null,
    imageUrl: (formData.get("imageUrl") as string) || null,
  };

  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
    };
  }

  await saveProduct({ ...parsed.data, isActive: true });

  revalidatePath("/admin/products");
  revalidatePath("/pos");

  return { ok: true as const };
}

export async function deleteProductAction(id: string) {
  await softDeleteProduct(id);
  revalidatePath("/admin/products");
  revalidatePath("/pos");
}

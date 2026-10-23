"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

z.config({ jitless: true });

import { MAX_INT_VND } from "@/lib/money";
import { isPublicHttpsUrl } from "@/lib/safe-url";
import {
  ADMIN_UNAUTHORIZED_MESSAGE,
  adminEntityIdSchema,
  authorizeAdminAction,
  INVALID_INPUT_MESSAGE,
  isRecordNotFound,
} from "@/server/admin/admin-action";
import { revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
import { saveProductImage } from "@/server/products/save-image";
import { saveProduct, softDeleteProduct } from "@/server/products/save-product";
import type { AdminActionResult } from "@/types/admin-action";

const PRODUCT_NOT_FOUND = {
  ok: false as const,
  message: "Không tìm thấy sản phẩm",
};

const quickUpdateSchema = z.object({
  id: z.string().min(1),
  price: z.coerce
    .number()
    .int()
    .min(0, "Giá bán không được âm")
    .max(MAX_INT_VND, "Giá bán quá lớn"),
  stock: z.coerce.number().finite("Tồn kho không hợp lệ"),
});

const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Tên sản phẩm không được để trống"),
  sku: z.string().nullable(),
  categoryId: z.string().nullable(),
  unit: z.string().trim().min(1, "Đơn vị tính không được để trống"),
  price: z.coerce.number().int().min(0).max(MAX_INT_VND, "Giá bán quá lớn"),
  costPrice: z.coerce.number().int().min(0).max(MAX_INT_VND, "Giá vốn quá lớn"),
  stock: z.coerce.number(),
  aliases: z.string().nullable(),
  imageUrl: z
    .union(
      [
        z.literal(""),
        // /products/<file> (anh mau) va /uploads/[products/]<file> (anh tai len)
        z
          .string()
          .regex(
            /^\/(?:products\/|uploads\/(?:products\/)?)[a-zA-Z0-9][a-zA-Z0-9.-]*$/,
          ),
        z
          .string()
          .refine(isPublicHttpsUrl, "Ảnh phải dùng đường dẫn https công khai"),
      ],
      { error: "Đường dẫn ảnh sản phẩm không hợp lệ" },
    )
    .nullable(),
});

export async function saveProductAction(formData: FormData) {
  if (!(await authorizeAdminAction())) {
    return { ok: false as const, message: ADMIN_UNAUTHORIZED_MESSAGE };
  }

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
      message: parsed.error.issues[0]?.message ?? INVALID_INPUT_MESSAGE,
    };
  }

  const image = formData.get("image");
  let effectiveImageUrl: string | null = parsed.data.imageUrl || null;

  if (image instanceof File && image.size > 0) {
    const saved = await saveProductImage(image);
    if (!saved.ok) {
      return { ok: false as const, message: saved.message };
    }
    effectiveImageUrl = saved.imageUrl;
  }

  await saveProduct({
    ...parsed.data,
    isActive: true,
    imageUrl: effectiveImageUrl,
  });

  revalidatePath("/admin/products");
  revalidatePath("/pos");

  return { ok: true as const };
}

export async function quickUpdateProductAction(formData: FormData) {
  if (!(await authorizeAdminAction())) {
    return { ok: false as const, message: ADMIN_UNAUTHORIZED_MESSAGE };
  }

  const parsed = quickUpdateSchema.safeParse({
    id: formData.get("id"),
    price: formData.get("price"),
    stock: formData.get("stock"),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? INVALID_INPUT_MESSAGE,
    };
  }

  try {
    await prisma.product.update({
      where: { id: parsed.data.id, deletedAt: null },
      data: { price: parsed.data.price, stock: parsed.data.stock },
    });
  } catch (error) {
    if (isRecordNotFound(error)) return PRODUCT_NOT_FOUND;
    throw error;
  }
  revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.product(parsed.data.id));

  revalidatePath("/admin/products");
  revalidatePath("/pos");

  return { ok: true as const };
}

export async function deleteProductAction(
  id: string,
): Promise<AdminActionResult> {
  if (!(await authorizeAdminAction())) {
    return { ok: false, message: ADMIN_UNAUTHORIZED_MESSAGE };
  }

  const parsed = adminEntityIdSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: INVALID_INPUT_MESSAGE };

  try {
    await softDeleteProduct(parsed.data);
  } catch (error) {
    if (isRecordNotFound(error)) return PRODUCT_NOT_FOUND;
    throw error;
  }
  revalidatePath("/admin/products");
  revalidatePath("/pos");

  return { ok: true };
}

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
import { logAdminAction } from "@/server/auth/admin-audit";
import { saveProductImage } from "@/server/products/save-image";
import {
  ProductStockConflictError,
  quickUpdateProduct,
  saveProduct,
  softDeleteProduct,
  type StockChange,
} from "@/server/products/save-product";
import type { AdminActionResult } from "@/types/admin-action";

const PRODUCT_NOT_FOUND = {
  ok: false as const,
  message: "Không tìm thấy sản phẩm",
};

const quickUpdateSchema = z.object({
  id: adminEntityIdSchema,
  price: z.coerce
    .number()
    .int()
    .min(0, "Giá bán không được âm")
    .max(MAX_INT_VND, "Giá bán quá lớn"),
  stock: z.coerce.number().finite("Tồn kho không hợp lệ"),
  originalStock: z.coerce.number().finite("Tồn kho không hợp lệ"),
});

const schema = z.object({
  id: adminEntityIdSchema.optional(),
  name: z.string().trim().min(1, "Tên sản phẩm không được để trống"),
  sku: z.string().nullable(),
  categoryId: z.string().nullable(),
  unit: z.string().trim().min(1, "Đơn vị tính không được để trống"),
  price: z.coerce.number().int().min(0).max(MAX_INT_VND, "Giá bán quá lớn"),
  costPrice: z.coerce.number().int().min(0).max(MAX_INT_VND, "Giá vốn quá lớn"),
  stock: z.coerce.number(),
  // Tồn kho lúc mở form sửa: chỉ ghi tồn kho khi admin thực sự đổi số.
  originalStock: z.coerce.number().optional(),
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

/** Lỗi nghiệp vụ khi lưu sản phẩm thành `{ ok: false }`; lỗi lạ ném lại. */
function productSaveFailure(error: unknown) {
  if (error instanceof ProductStockConflictError) {
    return { ok: false as const, message: error.message };
  }
  if (isRecordNotFound(error)) return PRODUCT_NOT_FOUND;
  throw error;
}

async function logStockAdjustment(
  identityId: string | undefined,
  productId: string,
  stockChange: StockChange | null,
) {
  if (!stockChange) return;
  await logAdminAction({
    identityId,
    action: "product.stock_adjust",
    entityType: "product",
    entityId: productId,
    metadata: { ...stockChange },
  });
}

export async function saveProductAction(formData: FormData) {
  const session = await authorizeAdminAction();
  if (!session) {
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
    originalStock: (formData.get("originalStock") as string) || undefined,
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
  // Form sửa luôn gửi tồn kho gốc; thiếu thì không biết admin có đổi số không.
  if (parsed.data.id && parsed.data.originalStock === undefined) {
    return { ok: false as const, message: INVALID_INPUT_MESSAGE };
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

  let saved: Awaited<ReturnType<typeof saveProduct>>;
  try {
    // Tạo mới mặc định đang bán; sửa thì giữ trạng thái ẩn/hiện đang có.
    saved = await saveProduct({
      ...parsed.data,
      imageUrl: effectiveImageUrl,
    });
  } catch (error) {
    return productSaveFailure(error);
  }
  await logStockAdjustment(session.identity?.id, saved.id, saved.stockChange);

  revalidatePath("/admin/products");
  revalidatePath("/pos");

  return { ok: true as const };
}

export async function quickUpdateProductAction(formData: FormData) {
  const session = await authorizeAdminAction();
  if (!session) {
    return { ok: false as const, message: ADMIN_UNAUTHORIZED_MESSAGE };
  }

  const parsed = quickUpdateSchema.safeParse({
    id: formData.get("id"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    originalStock: formData.get("originalStock") ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? INVALID_INPUT_MESSAGE,
    };
  }

  let stockChange: StockChange | null;
  try {
    ({ stockChange } = await quickUpdateProduct(parsed.data));
  } catch (error) {
    return productSaveFailure(error);
  }
  await logStockAdjustment(session.identity?.id, parsed.data.id, stockChange);

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

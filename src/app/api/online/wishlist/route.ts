import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { getWishlistProducts } from "@/server/storefront/wishlist-products";

const NO_STORE = { "Cache-Control": "private, no-store" };
const MAX_IDS = 100;

const querySchema = z
  .string()
  .max(MAX_IDS * 65)
  .transform((raw) => [
    ...new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ])
  .pipe(
    z
      .array(z.string().min(1).max(64))
      .max(MAX_IDS, `Danh sách yêu thích tối đa ${MAX_IDS} sản phẩm`),
  );

/** Thong tin cong khai cua san pham trong danh sach yeu thich (luu o may khach). */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const products = await getWishlistProducts(parsed.data);
    return NextResponse.json({ data: { products } }, { headers: NO_STORE });
  } catch (error: unknown) {
    logger.error("wishlist_products_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { message: "Không tải được danh sách yêu thích. Vui lòng thử lại." },
      { status: 500, headers: NO_STORE },
    );
  }
}

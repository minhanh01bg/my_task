import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getPosCatalog } from "@/server/catalog/get-pos-catalog";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Máy bán tải TOÀN BỘ danh mục một lần lúc mở ca rồi tìm kiếm trong bộ nhớ.
 * Vì vậy endpoint này trả về tất cả sản phẩm đang bán, không phân trang.
 */
export async function GET(request: Request) {
  try {
    if (!(await hasAdminSession(request))) {
      return NextResponse.json(
        { message: "Chưa đăng nhập" },
        { status: 401, headers: PRIVATE_HEADERS },
      );
    }

    const catalog = await getPosCatalog();
    return NextResponse.json(catalog, { headers: PRIVATE_HEADERS });
  } catch (error) {
    const correlationId = crypto.randomUUID();
    logger.error("pos_catalog_failed", {
      correlationId,
      errorClass:
        error instanceof Error ? error.constructor.name : typeof error,
    });
    return NextResponse.json(
      {
        message: "Không tải được danh mục lúc này. Vui lòng thử lại.",
        correlationId,
      },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}

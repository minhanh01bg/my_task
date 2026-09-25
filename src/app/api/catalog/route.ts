import { NextResponse } from "next/server";

import { getPosCatalog } from "@/server/catalog/get-pos-catalog";

/**
 * Máy bán tải TOÀN BỘ danh mục một lần lúc mở ca rồi tìm kiếm trong bộ nhớ.
 * Vì vậy endpoint này trả về tất cả sản phẩm đang bán, không phân trang.
 */
export async function GET() {
  const catalog = await getPosCatalog();
  return NextResponse.json(catalog);
}

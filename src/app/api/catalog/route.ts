import { NextResponse } from "next/server";

import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getPosCatalog } from "@/server/catalog/get-pos-catalog";

/**
 * Máy bán tải TOÀN BỘ danh mục một lần lúc mở ca rồi tìm kiếm trong bộ nhớ.
 * Vì vậy endpoint này trả về tất cả sản phẩm đang bán, không phân trang.
 */
export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const catalog = await getPosCatalog();
  return NextResponse.json(catalog);
}

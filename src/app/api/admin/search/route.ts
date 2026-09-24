import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import {
  ADMIN_SEARCH_MAX_QUERY_LENGTH,
  searchAdmin,
} from "@/server/admin/search";
import { hasAdminSession } from "@/server/auth/require-admin-session";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

const searchQuerySchema = z
  .object({
    q: z.string().trim().max(ADMIN_SEARCH_MAX_QUERY_LENGTH).default(""),
  })
  .strict();

export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { message: "Chưa đăng nhập" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }
  const url = new URL(request.url);
  const parsed = searchQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Tham số không hợp lệ" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  try {
    return NextResponse.json(
      { data: await searchAdmin(parsed.data.q) },
      { headers: PRIVATE_HEADERS },
    );
  } catch (error) {
    logger.error("admin_search_failed", {
      errorClass:
        error instanceof Error ? error.constructor.name : typeof error,
    });
    return NextResponse.json(
      { message: "Không tìm được lúc này. Vui lòng thử lại." },
      { status: 500, headers: PRIVATE_HEADERS },
    );
  }
}

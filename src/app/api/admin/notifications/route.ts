import { NextResponse } from "next/server";

import { hasAdminSession } from "@/server/auth/require-admin-session";
import { listAdminNotifications } from "@/server/notifications/admin-notifications";
import { notificationListQuerySchema } from "@/types/admin-notification";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { message: "Chưa đăng nhập" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const parsed = notificationListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Tham số không hợp lệ" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  try {
    return NextResponse.json(
      { data: await listAdminNotifications(parsed.data) },
      { headers: PRIVATE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { message: "Cursor không hợp lệ" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
}

import { NextResponse } from "next/server";

import { hasAdminSession } from "@/server/auth/require-admin-session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import { markAdminNotificationsRead } from "@/server/notifications/admin-notifications";
import { notificationReadSchema } from "@/types/admin-notification";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
// `{ "allBefore": "<ISO datetime>" }` or `{ "id": "<64 chars>" }` fit easily.
const MAX_READ_BODY_BYTES = 1_000;

export async function POST(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json(
      { message: "Chưa đăng nhập" },
      { status: 401, headers: PRIVATE_HEADERS },
    );
  }
  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { message: "Origin không hợp lệ" },
      { status: 403, headers: PRIVATE_HEADERS },
    );
  }
  const body = await readJsonBody(request, { maxBytes: MAX_READ_BODY_BYTES });
  if (!body.ok) {
    return NextResponse.json(
      { message: body.message },
      { status: body.status, headers: PRIVATE_HEADERS },
    );
  }
  const parsed = notificationReadSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu không hợp lệ" },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  const unreadCount = await markAdminNotificationsRead(parsed.data);
  return NextResponse.json(
    { data: { unreadCount } },
    { headers: PRIVATE_HEADERS },
  );
}

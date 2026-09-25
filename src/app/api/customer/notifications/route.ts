import { NextResponse } from "next/server";

import { resolveCustomerSessionToken } from "@/server/customer-auth/session";
import { listCustomerNotifications } from "@/server/notifications/customer-notifications";
import { customerNotificationsQuerySchema } from "@/types/customer-notification";

export async function GET(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)customer_session=([^;]+)/)?.[1];
  const session = await resolveCustomerSessionToken(
    cookie ? decodeURIComponent(cookie) : null,
  );

  if (!session) {
    return NextResponse.json(
      { message: "Chưa đăng nhập" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const url = new URL(request.url);
  const parsedQuery = customerNotificationsQuerySchema.safeParse({
    limit: url.searchParams.get("limit") || 20,
    cursor: url.searchParams.get("cursor") || undefined,
  });

  const { limit, cursor } = parsedQuery.success
    ? parsedQuery.data
    : { limit: 20, cursor: undefined };

  const result = await listCustomerNotifications({
    accountId: session.accountId,
    limit,
    cursor,
  });

  return NextResponse.json(result, {
    status: 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}

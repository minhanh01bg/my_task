import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";
import { resolveCustomerSessionToken } from "@/server/customer-auth/session";
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

  const [unreadCount, rawItems] = await Promise.all([
    prisma.customerNotification.count({
      where: {
        accountId: session.accountId,
        readAt: null,
      },
    }),
    prisma.customerNotification.findMany({
      where: { accountId: session.accountId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  ]);

  let nextCursor: string | null = null;
  const items = [...rawItems];

  if (items.length > limit) {
    items.pop();
    nextCursor = items[items.length - 1]?.id ?? null;
  }

  return NextResponse.json(
    {
      items,
      unreadCount,
      nextCursor,
    },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

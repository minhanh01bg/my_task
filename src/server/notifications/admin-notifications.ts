import { prisma } from "@/server/db/prisma";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
  type NotificationCursor,
} from "@/types/admin-notification";

export async function listAdminNotifications(input: {
  cursor?: string;
  limit: number;
}) {
  const cursor: NotificationCursor | undefined = input.cursor
    ? decodeNotificationCursor(input.cursor)
    : undefined;
  const cutoff = new Date();
  const [rows, unreadCount] = await prisma.$transaction([
    prisma.adminNotification.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: new Date(cursor.createdAt) } },
              {
                createdAt: new Date(cursor.createdAt),
                id: { lt: cursor.id },
              },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      select: {
        id: true,
        kind: true,
        title: true,
        body: true,
        entityType: true,
        entityId: true,
        href: true,
        createdAt: true,
        readAt: true,
      },
    }),
    prisma.adminNotification.count({ where: { readAt: null } }),
  ]);
  const hasMore = rows.length > input.limit;
  const items = rows.slice(0, input.limit);
  const last = items.at(-1);
  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      readAt: item.readAt?.toISOString() ?? null,
    })),
    nextCursor:
      hasMore && last
        ? encodeNotificationCursor({
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null,
    unreadCount,
    cutoff: cutoff.toISOString(),
  };
}

export async function markAdminNotificationsRead(
  input: { id: string } | { allBefore: string },
) {
  const readAt = new Date();
  if ("id" in input) {
    await prisma.adminNotification.updateMany({
      where: { id: input.id, readAt: null },
      data: { readAt },
    });
  } else {
    await prisma.adminNotification.updateMany({
      where: { readAt: null, createdAt: { lte: new Date(input.allBefore) } },
      data: { readAt },
    });
  }
  return prisma.adminNotification.count({ where: { readAt: null } });
}

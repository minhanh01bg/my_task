import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export const customerNotificationListSelect = {
  id: true,
  accountId: true,
  eventKey: true,
  kind: true,
  title: true,
  body: true,
  orderId: true,
  href: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.CustomerNotificationSelect;

export type CustomerNotificationItem = Prisma.CustomerNotificationGetPayload<{
  select: typeof customerNotificationListSelect;
}>;

export interface ListCustomerNotificationsOptions {
  accountId: string;
  limit?: number;
  cursor?: string;
}

export interface ListCustomerNotificationsResult {
  items: CustomerNotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
}

/**
 * Lấy danh sách thông báo phân trang bằng cursor và đếm số thông báo chưa đọc của tài khoản khách hàng.
 */
export async function listCustomerNotifications({
  accountId,
  limit = 20,
  cursor,
}: ListCustomerNotificationsOptions): Promise<ListCustomerNotificationsResult> {
  const [unreadCount, rawItems] = await Promise.all([
    prisma.customerNotification.count({
      where: {
        accountId,
        readAt: null,
      },
    }),
    prisma.customerNotification.findMany({
      where: { accountId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: customerNotificationListSelect,
    }),
  ]);

  let nextCursor: string | null = null;
  const items = [...rawItems];

  if (items.length > limit) {
    items.pop();
    nextCursor = items[items.length - 1]?.id ?? null;
  }

  return {
    items,
    unreadCount,
    nextCursor,
  };
}

export interface MarkCustomerNotificationsReadOptions {
  accountId: string;
  notificationId?: string;
}

/**
 * Đánh dấu một thông báo cụ thể hoặc tất cả thông báo của tài khoản khách hàng là đã đọc.
 */
export async function markCustomerNotificationsRead({
  accountId,
  notificationId,
}: MarkCustomerNotificationsReadOptions): Promise<void> {
  const readAt = new Date();
  if (notificationId) {
    await prisma.customerNotification.updateMany({
      where: {
        id: notificationId,
        accountId,
        readAt: null,
      },
      data: { readAt },
    });
  } else {
    await prisma.customerNotification.updateMany({
      where: {
        accountId,
        readAt: null,
      },
      data: { readAt },
    });
  }
}

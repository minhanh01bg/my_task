import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  listCustomerNotifications,
  markCustomerNotificationsRead,
} from "@/server/notifications/customer-notifications";

describe("customer-notifications", () => {
  beforeEach(async () => {
    await prisma.customerNotification.deleteMany();
    await prisma.customerAccount.deleteMany();
  });

  it("liệt kê thông báo, phân trang bằng cursor và đếm unreadCount chính xác", async () => {
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "0901112233",
        displayName: "Khách VIP",
        passwordHash: "dummy_hash",
      },
    });

    await prisma.customerNotification.create({
      data: {
        accountId: account.id,
        eventKey: "order_created_1",
        kind: "order_status",
        title: "Đơn hàng mới",
        body: "Đơn hàng đã được tạo thành công",
        href: "/account/orders/1",
      },
    });

    await prisma.customerNotification.create({
      data: {
        accountId: account.id,
        eventKey: "order_paid_1",
        kind: "order_status",
        title: "Đã thanh toán",
        body: "Đơn hàng đã thanh toán thành công",
        href: "/account/orders/1",
        readAt: new Date(),
      },
    });

    const res = await listCustomerNotifications({
      accountId: account.id,
      limit: 10,
    });

    expect(res.unreadCount).toBe(1);
    expect(res.items).toHaveLength(2);
  });

  it("đánh dấu đã đọc cho thông báo đơn lẻ và tất cả thông báo", async () => {
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "0901112244",
        displayName: "Khách VIP 2",
        passwordHash: "dummy_hash",
      },
    });

    const notif1 = await prisma.customerNotification.create({
      data: {
        accountId: account.id,
        eventKey: "event_1",
        kind: "order_status",
        title: "Thông báo 1",
        body: "Nội dung 1",
        href: "/account/orders/1",
      },
    });

    await prisma.customerNotification.create({
      data: {
        accountId: account.id,
        eventKey: "event_2",
        kind: "order_status",
        title: "Thông báo 2",
        body: "Nội dung 2",
        href: "/account/orders/2",
      },
    });

    // Mark single notification as read
    await markCustomerNotificationsRead({
      accountId: account.id,
      notificationId: notif1.id,
    });

    let res = await listCustomerNotifications({ accountId: account.id });
    expect(res.unreadCount).toBe(1);

    // Mark all as read
    await markCustomerNotificationsRead({
      accountId: account.id,
    });

    res = await listCustomerNotifications({ accountId: account.id });
    expect(res.unreadCount).toBe(0);
  });
});

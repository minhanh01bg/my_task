import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createCustomerSession } from "@/server/customer-auth/session";
import { GET } from "@/app/api/customer/notifications/route";
import { POST as markReadPOST } from "@/app/api/customer/notifications/read/route";

describe("Customer Notifications API Routes", () => {
  let accountAId: string;
  let accountBId: string;
  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    await prisma.customerNotification.deleteMany();
    await prisma.customerSession.deleteMany();
    await prisma.customerAccount.deleteMany();

    const accountA = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "+84900000881",
        displayName: "Khách A",
        passwordHash: "dummy",
        phoneVerifiedAt: new Date(),
      },
    });
    accountAId = accountA.id;
    const sessionA = await createCustomerSession(accountAId);
    tokenA = sessionA.token;

    const accountB = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "+84900000882",
        displayName: "Khách B",
        passwordHash: "dummy",
        phoneVerifiedAt: new Date(),
      },
    });
    accountBId = accountB.id;
    const sessionB = await createCustomerSession(accountBId);
    tokenB = sessionB.token;

    // Seed notifications for A
    await prisma.customerNotification.createMany({
      data: [
        {
          accountId: accountAId,
          eventKey: "a-1",
          kind: "order_created",
          title: "Đơn 1",
          body: "Nội dung 1",
          href: "/account/orders/1",
          createdAt: new Date("2026-09-08T01:00:00Z"),
        },
        {
          accountId: accountAId,
          eventKey: "a-2",
          kind: "order_status_confirmed",
          title: "Đơn 2",
          body: "Nội dung 2",
          href: "/account/orders/2",
          createdAt: new Date("2026-09-08T02:00:00Z"),
        },
        {
          accountId: accountAId,
          eventKey: "a-3",
          kind: "order_status_completed",
          title: "Đơn 3",
          body: "Nội dung 3",
          href: "/account/orders/3",
          createdAt: new Date("2026-09-08T03:00:00Z"),
          readAt: new Date(),
        },
      ],
    });

    // Seed notifications for B
    await prisma.customerNotification.createMany({
      data: [
        {
          accountId: accountBId,
          eventKey: "b-1",
          kind: "order_created",
          title: "Đơn B1",
          body: "Nội dung B1",
          href: "/account/orders/b1",
          createdAt: new Date("2026-09-08T04:00:00Z"),
        },
      ],
    });
  });

  it("từ chối 401 khi không có customer_session cookie", async () => {
    const req = new Request("http://localhost/api/customer/notifications");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("từ chối 401 khi chỉ có admin cookie hoặc guest token", async () => {
    const req = new Request("http://localhost/api/customer/notifications", {
      headers: {
        cookie: "admin_session=invalid-admin-cookie; other_token=xyz",
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("cho phép tài khoản A đọc đúng thông báo của mình và unreadCount", async () => {
    const req = new Request("http://localhost/api/customer/notifications", {
      headers: {
        cookie: `customer_session=${tokenA}`,
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.unreadCount).toBe(2); // a-1 và a-2 chưa đọc, a-3 đã đọc
    expect(data.items).toHaveLength(3);
    expect(
      data.items.every(
        (item: { accountId: string }) => item.accountId === accountAId,
      ),
    ).toBe(true);
    expect(data.items[0].eventKey).toBe("a-3"); // newest first

    // Đảm bảo tài khoản B chỉ thấy thông báo của B
    const reqB = new Request("http://localhost/api/customer/notifications", {
      headers: {
        cookie: `customer_session=${tokenB}`,
      },
    });
    const resB = await GET(reqB);
    const dataB = await resB.json();
    expect(dataB.unreadCount).toBe(1);
    expect(dataB.items).toHaveLength(1);
    expect(dataB.items[0].accountId).toBe(accountBId);
  });

  it("hỗ trợ phân trang bằng cursor và limit", async () => {
    const req1 = new Request(
      "http://localhost/api/customer/notifications?limit=2",
      {
        headers: {
          cookie: `customer_session=${tokenA}`,
        },
      },
    );
    const res1 = await GET(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.items).toHaveLength(2);
    expect(data1.nextCursor).toBeDefined();

    const req2 = new Request(
      `http://localhost/api/customer/notifications?limit=2&cursor=${data1.nextCursor}`,
      {
        headers: {
          cookie: `customer_session=${tokenA}`,
        },
      },
    );
    const res2 = await GET(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.items).toHaveLength(1);
    expect(data2.nextCursor).toBeNull();
  });

  it("đánh dấu đọc 1 thông báo và không cho tài khoản A đánh dấu thông báo của B", async () => {
    const notifB = await prisma.customerNotification.findUnique({
      where: { eventKey: "b-1" },
    });
    expect(notifB).toBeDefined();

    // Account A tries to mark B's notification
    const reqBad = new Request(
      "http://localhost/api/customer/notifications/read",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `customer_session=${tokenA}`,
          origin: "http://localhost",
        },
        body: JSON.stringify({ notificationId: notifB!.id }),
      },
    );
    const resBad = await markReadPOST(reqBad);
    expect(resBad.status).toBe(200);

    // B's notification is still unread!
    const notifBAfter = await prisma.customerNotification.findUnique({
      where: { id: notifB!.id },
    });
    expect(notifBAfter?.readAt).toBeNull();

    // Account A marks A's notification
    const notifA = await prisma.customerNotification.findUnique({
      where: { eventKey: "a-1" },
    });
    const reqGood = new Request(
      "http://localhost/api/customer/notifications/read",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `customer_session=${tokenA}`,
          origin: "http://localhost",
        },
        body: JSON.stringify({ notificationId: notifA!.id }),
      },
    );
    const resGood = await markReadPOST(reqGood);
    expect(resGood.status).toBe(200);

    const notifAAfter = await prisma.customerNotification.findUnique({
      where: { id: notifA!.id },
    });
    expect(notifAAfter?.readAt).not.toBeNull();
  });

  it("đánh dấu đọc toàn bộ (mark all read) chỉ ảnh hưởng thông báo của tài khoản hiện tại", async () => {
    const req = new Request(
      "http://localhost/api/customer/notifications/read",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `customer_session=${tokenA}`,
          origin: "http://localhost",
        },
        body: JSON.stringify({ all: true }),
      },
    );
    const res = await markReadPOST(req);
    expect(res.status).toBe(200);

    const unreadCountA = await prisma.customerNotification.count({
      where: { accountId: accountAId, readAt: null },
    });
    expect(unreadCountA).toBe(0);

    // B remains unread
    const unreadCountB = await prisma.customerNotification.count({
      where: { accountId: accountBId, readAt: null },
    });
    expect(unreadCountB).toBe(1);
  });

  afterAll(async () => {
    await prisma.customerNotification.deleteMany();
    await prisma.customerSession.deleteMany();
    await prisma.customerAccount.deleteMany();
  });
});

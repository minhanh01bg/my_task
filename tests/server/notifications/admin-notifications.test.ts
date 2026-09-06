import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  listAdminNotifications,
  markAdminNotificationsRead,
} from "@/server/notifications/admin-notifications";

async function seed(createdAt: Date) {
  const id = randomUUID();
  return prisma.adminNotification.create({
    data: {
      id,
      eventKey: `test:${id}`,
      kind: "online_order_created",
      title: "Có đơn mới",
      body: "Đơn kiểm thử",
      entityType: "order",
      entityId: id,
      href: `/admin/orders/${id}`,
      createdAt,
    },
  });
}

beforeEach(async () => prisma.adminNotification.deleteMany());
afterAll(async () => prisma.$disconnect());

describe("admin notifications", () => {
  it("phân trang ổn định và đếm unread", async () => {
    const at = new Date("2026-09-06T10:00:00.000Z");
    await seed(at);
    await seed(at);
    await seed(new Date("2026-09-06T09:00:00.000Z"));
    const first = await listAdminNotifications({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.unreadCount).toBe(3);
    expect(first.nextCursor).toBeTruthy();
    const second = await listAdminNotifications({
      limit: 2,
      cursor: first.nextCursor!,
    });
    expect(second.items).toHaveLength(1);
    expect(
      new Set([...first.items, ...second.items].map((item) => item.id)).size,
    ).toBe(3);
  });

  it("mark-one lặp lại vẫn idempotent", async () => {
    const item = await seed(new Date());
    await markAdminNotificationsRead({ id: item.id });
    expect(await markAdminNotificationsRead({ id: item.id })).toBe(0);
  });

  it("mark-all cutoff không đọc notification đến sau", async () => {
    const before = await seed(new Date("2026-09-06T10:00:00.000Z"));
    const cutoff = "2026-09-06T10:00:01.000Z";
    const after = await seed(new Date("2026-09-06T10:00:02.000Z"));
    expect(await markAdminNotificationsRead({ allBefore: cutoff })).toBe(1);
    const rows = await prisma.adminNotification.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(rows.find((row) => row.id === before.id)?.readAt).not.toBeNull();
    expect(rows.find((row) => row.id === after.id)?.readAt).toBeNull();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import OrderDetailPage from "@/app/admin/orders/[id]/page";
import { prisma } from "@/server/db/prisma";
import {
  getNextOnlineOrderStatuses,
  ONLINE_ORDER_STATUS_LABELS,
  ONLINE_ORDER_STATUSES,
} from "@/server/orders/online-order-status";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ userId: "admin" }),
}));
vi.mock("@/app/admin/orders/actions", () => ({
  markOnlineOrderPaidAction: vi.fn(),
  transitionOnlineOrderAction: vi.fn(),
}));
vi.mock("@/server/db/prisma", () => ({
  prisma: { order: { findUnique: vi.fn() } },
}));

function mockOnlineOrder(fulfillmentStatus: string) {
  vi.mocked(prisma.order.findUnique).mockResolvedValue({
    id: "o1",
    code: "DH-201",
    status: "paid",
    channel: "online",
    fulfillmentStatus,
    fulfillmentType: "delivery",
    paymentMethod: "cod",
    contactName: "Khách",
    contactPhone: "0901234567",
    createdAt: new Date("2026-09-20T03:00:00Z"),
    subtotal: 150_000,
    discount: 0,
    total: 150_000,
    customer: null,
    items: [],
    payments: [],
  } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);
}

describe("/admin/orders/[id] — nút chuyển trạng thái đơn online", () => {
  it.each(ONLINE_ORDER_STATUSES)(
    "trạng thái %s hiển thị đúng mọi bước chuyển hợp lệ",
    async (status) => {
      mockOnlineOrder(status);
      render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));

      const allowed = getNextOnlineOrderStatuses(status);
      for (const next of allowed) {
        expect(
          screen.getByRole("button", {
            name: ONLINE_ORDER_STATUS_LABELS[next],
          }),
        ).toBeInTheDocument();
      }
      for (const other of ONLINE_ORDER_STATUSES.filter(
        (candidate) => !allowed.includes(candidate),
      )) {
        expect(
          screen.queryByRole("button", {
            name: ONLINE_ORDER_STATUS_LABELS[other],
          }),
        ).not.toBeInTheDocument();
      }
      cleanup();
    },
  );
});

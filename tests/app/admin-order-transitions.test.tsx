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
vi.mock("@/server/settings/store-settings", () => ({
  getPublicStoreProfile: vi.fn().mockResolvedValue({ name: "Tiệm Test" }),
  getStoreBankAccount: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/server/db/prisma", () => ({
  prisma: { order: { findUnique: vi.fn() } },
}));

function mockOnlineOrder(
  fulfillmentStatus: string,
  extra: Record<string, unknown> = {},
) {
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
    voucherCode: null,
    voucherDiscount: 0,
    shippingFee: 0,
    ...extra,
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

describe("/admin/orders/[id] — in hoá đơn K80", () => {
  it("có nút In hoá đơn", async () => {
    mockOnlineOrder("new");
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(
      screen.getByRole("button", { name: "In hoá đơn" }),
    ).toBeInTheDocument();
    cleanup();
  });
});

describe("/admin/orders/[id] — dòng voucher", () => {
  it("mã giảm tiền hàng: hiện 'Trong đó mã …'", async () => {
    mockOnlineOrder("new", { voucherCode: "GIAM10", voucherDiscount: 10_000 });
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.getByText("Trong đó mã GIAM10")).toBeInTheDocument();
    expect(screen.queryByTestId("freeship-code")).not.toBeInTheDocument();
    cleanup();
  });

  it("mã freeship: không hiện 'Trong đó mã', ghi mã cạnh phí giao hàng", async () => {
    mockOnlineOrder("new", { voucherCode: "FREESHIP", voucherDiscount: 0 });
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(screen.queryByText(/Trong đó mã/)).not.toBeInTheDocument();
    expect(screen.getByTestId("freeship-code")).toHaveTextContent(
      "(mã FREESHIP)",
    );
    cleanup();
  });
});

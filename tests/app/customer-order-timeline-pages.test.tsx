import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CustomerOrderPage from "@/app/account/orders/[id]/page";
import OrderSuccessPage from "@/app/order-success/[receipt]/page";
import GuestOrderPage from "@/app/orders/guest/[token]/page";
import { requireCustomerSession } from "@/server/customer-auth/session";
import {
  findGuestOrder,
  findOwnedCustomerOrder,
} from "@/server/orders/order-access";
import { getPublicReceipt } from "@/server/orders/public-receipt";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/server/customer-auth/session", () => ({
  requireCustomerSession: vi.fn(),
}));
vi.mock("@/server/orders/order-access", () => ({
  findOwnedCustomerOrder: vi.fn(),
  findGuestOrder: vi.fn(),
}));
vi.mock("@/server/orders/public-receipt", () => ({
  getPublicReceipt: vi.fn(),
}));

const createdAt = new Date("2026-09-20T03:15:00.000Z");

const order = {
  id: "ord-1",
  code: "DH-ONLINE-001",
  createdAt,
  total: 180_000,
  status: "pending",
  fulfillmentStatus: "confirmed",
  fulfillmentType: "delivery",
  paymentMethod: "cod",
  contactName: "Nguyễn Văn An",
  contactPhone: "0901234567",
  deliveryAddress: "123 Đường Lê Lợi",
  deliveryWard: null,
  deliveryDistrict: null,
  deliveryProvince: null,
  note: null,
  items: [],
};

function expectTimelineAt(label: string) {
  const timeline = screen.getByRole("region", { name: "Trạng thái đơn hàng" });
  expect(within(timeline).getByText(label).closest("li")).toHaveAttribute(
    "aria-current",
    "step",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Timeline trạng thái trên các trang khách hàng", () => {
  it("trang chi tiết đơn của tài khoản hiển thị timeline", async () => {
    vi.mocked(requireCustomerSession).mockResolvedValue({
      accountId: "acc-1",
    } as Awaited<ReturnType<typeof requireCustomerSession>>);
    vi.mocked(findOwnedCustomerOrder).mockResolvedValue(order as never);

    render(
      await CustomerOrderPage({ params: Promise.resolve({ id: "ord-1" }) }),
    );

    expect(findOwnedCustomerOrder).toHaveBeenCalledWith("acc-1", "ord-1");
    expectTimelineAt("Đã xác nhận");
  });

  it("trang tra cứu đơn khách vãng lai hiển thị timeline", async () => {
    vi.mocked(findGuestOrder).mockResolvedValue({
      order: { ...order, fulfillmentStatus: "ready" },
    } as never);

    render(await GuestOrderPage({ params: Promise.resolve({ token: "tok" }) }));

    expectTimelineAt("Đang giao hàng");
  });

  it("trang đặt hàng thành công hiển thị timeline ở bước đơn mới", async () => {
    vi.mocked(getPublicReceipt).mockResolvedValue({
      code: "DH-ONLINE-001",
      total: 180_000,
      paymentMethod: "cod",
      status: "pending",
      fulfillmentStatus: "new",
      fulfillmentType: "delivery",
      createdAt,
    });

    render(
      await OrderSuccessPage({
        params: Promise.resolve({ receipt: "a".repeat(64) }),
      }),
    );

    expectTimelineAt("Đã đặt hàng");
    expect(document.querySelector("time")).toHaveAttribute(
      "dateTime",
      createdAt.toISOString(),
    );
  });

  it("trang đặt hàng thành công hiển thị trạng thái đã hủy", async () => {
    vi.mocked(getPublicReceipt).mockResolvedValue({
      code: "DH-ONLINE-001",
      total: 180_000,
      paymentMethod: "cod",
      status: "cancelled",
      fulfillmentStatus: "cancelled",
      fulfillmentType: "delivery",
      createdAt,
    });

    render(
      await OrderSuccessPage({
        params: Promise.resolve({ receipt: "a".repeat(64) }),
      }),
    );

    expectTimelineAt("Đã hủy");
  });
});

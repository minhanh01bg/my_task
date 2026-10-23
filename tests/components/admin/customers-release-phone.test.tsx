import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { releaseCustomerPhoneAction } from "@/app/(management)/admin/customers/actions";
import CustomersPage from "@/app/(management)/admin/customers/page";
import { listCustomers } from "@/server/admin/list-customers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/customers",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

vi.mock("@/server/admin/list-customers", () => ({ listCustomers: vi.fn() }));

vi.mock("@/app/(management)/admin/customers/actions", () => ({
  releaseCustomerPhoneAction: vi.fn(),
  toggleCustomerAccountAction: vi.fn(),
}));

function account(id: string, phoneNormalized: string, orders: number) {
  return {
    id,
    displayName: `Khách ${id}`,
    phoneNormalized,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    disabledAt: null,
    _count: { orders },
  };
}

async function renderPage(items: ReturnType<typeof account>[]) {
  vi.mocked(listCustomers).mockResolvedValue({
    items,
    total: items.length,
    page: 1,
    pageSize: 50,
  });
  const { container } = render(await CustomersPage({}));
  return {
    cards: container.querySelector<HTMLElement>('[data-layout="cards"]')!,
    table: container.querySelector<HTMLElement>('[data-layout="table"]')!,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("/admin/customers — Giải phóng số điện thoại", () => {
  it("chỉ hiện nút cho tài khoản chưa có đơn, ở cả thẻ và bảng", async () => {
    const { cards, table } = await renderPage([
      account("a1", "0911000111", 0),
      account("a2", "0911000222", 2),
    ]);

    for (const layout of [cards, table]) {
      expect(
        within(layout).getByRole("button", {
          name: "Giải phóng số điện thoại 0911000111",
        }),
      ).toBeInTheDocument();
      expect(
        within(layout).queryByRole("button", {
          name: "Giải phóng số điện thoại 0911000222",
        }),
      ).toBeNull();
    }
  });

  it("xác nhận rồi mới gọi action; bị từ chối thì hiện lý do", async () => {
    vi.mocked(releaseCustomerPhoneAction).mockResolvedValue({
      ok: false,
      message:
        "Tài khoản đã có đơn hàng nên không thể giải phóng số điện thoại.",
    });
    const { table } = await renderPage([account("a1", "0911000111", 0)]);
    const user = userEvent.setup();

    await user.click(
      within(table).getByRole("button", {
        name: "Giải phóng số điện thoại 0911000111",
      }),
    );
    expect(releaseCustomerPhoneAction).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Giải phóng số 0911000111?"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa tài khoản" }));

    expect(releaseCustomerPhoneAction).toHaveBeenCalledTimes(1);
    expect(releaseCustomerPhoneAction).toHaveBeenCalledWith("a1");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "không thể giải phóng số điện thoại",
    );
  });
});

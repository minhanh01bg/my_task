import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CategoriesPage from "@/app/(management)/admin/categories/page";
import CustomersPage from "@/app/(management)/admin/customers/page";
import DebtsPage from "@/app/(management)/admin/debts/page";
import OrderDetailPage from "@/app/(management)/admin/orders/[id]/page";
import OrdersPage from "@/app/(management)/admin/orders/page";
import ProductsPage from "@/app/(management)/admin/products/page";
import AdminPromotionsPage from "@/app/(management)/admin/promotions/page";
import ReportsPage from "@/app/(management)/admin/reports/page";
import { listCustomers } from "@/server/admin/list-customers";
import {
  listDebts,
  listSettledDebtsPage,
  listDebtCustomers,
} from "@/server/admin/list-debts";
import { listOrders } from "@/server/admin/list-orders";
import {
  findEditableProduct,
  listProductCategories,
  listProducts,
} from "@/server/admin/list-products";
import { prisma } from "@/server/db/prisma";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin",
  useSearchParams: () => new URLSearchParams(),
  redirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ userId: "admin" }),
}));

vi.mock("@/server/admin/list-orders", () => ({ listOrders: vi.fn() }));
vi.mock("@/server/admin/list-customers", () => ({ listCustomers: vi.fn() }));
vi.mock("@/server/admin/list-debts", () => ({
  listDebts: vi.fn(),
  listSettledDebtsPage: vi.fn(),
  listDebtCustomers: vi.fn(),
  SETTLED_DEBTS_LIMIT: 20,
}));
vi.mock("@/server/admin/list-products", () => ({
  findEditableProduct: vi.fn(),
  isProductStockStatus: (value: unknown) =>
    value === "low" || value === "out" || value === "negative",
  listProductCategories: vi.fn(),
  listProducts: vi.fn(),
}));
vi.mock("@/server/settings/store-settings", () => ({
  getPublicStoreProfile: vi.fn().mockResolvedValue({ name: "Tiệm Test" }),
  getStoreBankAccount: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/server/db/prisma", () => ({
  prisma: {
    category: { findMany: vi.fn(), count: vi.fn() },
    storefrontPromotion: { findMany: vi.fn(), count: vi.fn() },
    order: { findUnique: vi.fn() },
  },
}));

const EMPTY_PAGE = { items: [], total: 0, page: 1, pageSize: 20 };

function emptyState(container: HTMLElement, text: string) {
  const match = [
    ...container.querySelectorAll<HTMLElement>('[data-slot="empty-state"]'),
  ].find((node) => node.textContent?.includes(text));
  expect(match, `EmptyState "${text}"`).toBeDefined();
  return match!;
}

function layouts(container: HTMLElement) {
  const cards = container.querySelector<HTMLElement>('[data-layout="cards"]');
  const table = container.querySelector<HTMLElement>('[data-layout="table"]');
  expect(cards).not.toBeNull();
  expect(table).not.toBeNull();
  // Dien thoai: the; tu sm tro len: bang. Cung mot mang du lieu.
  expect(cards).toHaveClass("sm:hidden");
  expect(table).toHaveClass("hidden", "sm:block");
  return { cards: cards!, table: table! };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/admin/orders", () => {
  const order = {
    id: "o1",
    code: "DH-102",
    status: "paid",
    channel: "pos",
    fulfillmentStatus: null,
    hasStockWarning: false,
    createdAt: new Date("2026-09-20T03:00:00Z"),
    total: 150_000,
    customer: { name: "Cô Lan", phone: "0912000111" },
    items: [{ nameSnapshot: "Đường trắng", quantity: 2 }],
  };

  it("chua co don thi hien EmptyState", async () => {
    vi.mocked(listOrders).mockResolvedValue(EMPTY_PAGE);
    const { container } = render(
      await OrdersPage({ searchParams: Promise.resolve({}) }),
    );
    emptyState(container, "Chưa có đơn hàng nào");
  });

  it("dang loc ma khong ra don thi goi y bo loc", async () => {
    vi.mocked(listOrders).mockResolvedValue(EMPTY_PAGE);
    const { container } = render(
      await OrdersPage({ searchParams: Promise.resolve({ q: "zzz" }) }),
    );
    emptyState(container, "Không tìm thấy đơn phù hợp");
  });

  it("co don thi hien the tren dien thoai va bang tu sm, chi mot truy van", async () => {
    vi.mocked(listOrders).mockResolvedValue({
      ...EMPTY_PAGE,
      items: [order],
      total: 1,
    });
    const { container } = render(
      await OrdersPage({ searchParams: Promise.resolve({}) }),
    );
    const { cards, table } = layouts(container);
    expect(within(cards).getByRole("link", { name: "DH-102" })).toHaveAttribute(
      "href",
      "/admin/orders/o1",
    );
    expect(
      within(table).getByRole("link", { name: "DH-102" }),
    ).toBeInTheDocument();
    expect(table.querySelector('[data-slot="table"]')).not.toBeNull();
    expect(listOrders).toHaveBeenCalledTimes(1);
  });
});

describe("/admin/customers", () => {
  const account = {
    id: "c1",
    displayName: "Anh Tuấn",
    phoneNormalized: "0903000222",
    createdAt: new Date("2026-09-01T00:00:00Z"),
    disabledAt: null,
    _count: { orders: 3 },
  };

  it("chua co tai khoan thi hien EmptyState", async () => {
    vi.mocked(listCustomers).mockResolvedValue({ ...EMPTY_PAGE, pageSize: 50 });
    const { container } = render(await CustomersPage({}));
    emptyState(container, "Chưa có tài khoản khách hàng");
  });

  it("dung ui/table trong DataTableShell va the tren dien thoai", async () => {
    vi.mocked(listCustomers).mockResolvedValue({
      items: [account],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    const { container } = render(await CustomersPage({}));
    expect(screen.getByText("Danh sách tài khoản (1)")).toBeInTheDocument();
    const { cards, table } = layouts(container);
    expect(table.querySelector('[data-slot="table"]')).not.toBeNull();
    expect(container.querySelector("table:not([data-slot])")).toBeNull();
    expect(within(table).getByText("Anh Tuấn")).toBeInTheDocument();
    expect(within(cards).getByText("Anh Tuấn")).toBeInTheDocument();
    expect(within(cards).getByText("0903000222")).toBeInTheDocument();
    expect(listCustomers).toHaveBeenCalledTimes(1);
  });
});

describe("/admin/debts", () => {
  const debt = {
    id: "d1",
    code: "DH-201",
    total: 300_000,
    customer: { name: "Chú Ba", phone: null },
    payments: [],
    paid: 100_000,
    balance: 200_000,
  };

  it("khong ai no thi moi khoi deu dung EmptyState", async () => {
    vi.mocked(listDebts).mockResolvedValue({ ...EMPTY_PAGE, pageSize: 50 });
    vi.mocked(listDebtCustomers).mockResolvedValue(EMPTY_PAGE);
    vi.mocked(listSettledDebtsPage).mockResolvedValue(EMPTY_PAGE);
    const { container } = render(await DebtsPage({}));
    emptyState(container, "Không ai đang nợ");
    emptyState(container, "Hiện không còn đơn nào chưa trả đủ");
    emptyState(container, "Chưa có đơn công nợ nào được trả xong");
  });

  it("don con no hien the tren dien thoai va bang tu sm", async () => {
    vi.mocked(listDebts).mockResolvedValue({
      items: [debt],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    vi.mocked(listDebtCustomers).mockResolvedValue({
      ...EMPTY_PAGE,
      total: 1,
      items: [{ key: "k", name: "Chú Ba", balance: 200_000 }],
    });
    vi.mocked(listSettledDebtsPage).mockResolvedValue(EMPTY_PAGE);
    const { container } = render(await DebtsPage({}));
    const { cards, table } = layouts(container);
    expect(within(cards).getByText("DH-201")).toBeInTheDocument();
    expect(within(table).getByText("DH-201")).toBeInTheDocument();
    expect(table.querySelector('[data-slot="table"]')).not.toBeNull();
    expect(listDebts).toHaveBeenCalledTimes(1);
  });
  it("each debt list preserves the other lists' current pages", async () => {
    vi.mocked(listDebts).mockResolvedValue({
      ...EMPTY_PAGE,
      items: [debt],
      total: 120,
      page: 2,
      pageSize: 50,
    });
    vi.mocked(listDebtCustomers).mockResolvedValue({
      ...EMPTY_PAGE,
      items: [{ key: "k", name: "Chú Ba", balance: 200_000 }],
      total: 65,
      page: 2,
    });
    vi.mocked(listSettledDebtsPage).mockResolvedValue({
      ...EMPTY_PAGE,
      total: 65,
      page: 2,
    });
    render(
      await DebtsPage({
        searchParams: Promise.resolve({
          page: "2",
          customersPage: "2",
          settledPage: "2",
        }),
      }),
    );
    const open = screen.getByRole("navigation", {
      name: "Phân trang đơn còn nợ",
    });
    const customers = screen.getByRole("navigation", {
      name: "Phân trang khách còn nợ",
    });
    const settled = screen.getByRole("navigation", {
      name: "Phân trang đơn đã trả đủ",
    });
    expect(
      within(open).getByRole("link", { name: "Trang sau" }),
    ).toHaveAttribute(
      "href",
      "/admin/debts?customersPage=2&settledPage=2&page=3",
    );
    expect(
      within(customers).getByRole("link", { name: "Trang sau" }),
    ).toHaveAttribute(
      "href",
      "/admin/debts?page=2&settledPage=2&customersPage=3",
    );
    expect(
      within(settled).getByRole("link", { name: "Trang sau" }),
    ).toHaveAttribute(
      "href",
      "/admin/debts?page=2&customersPage=2&settledPage=3",
    );
  });
});

describe("/admin/products", () => {
  it("dung PageHeader va EmptyState khi khong co san pham", async () => {
    vi.mocked(listProductCategories).mockResolvedValue([]);
    vi.mocked(findEditableProduct).mockResolvedValue(null);
    vi.mocked(listProducts).mockResolvedValue({
      ...EMPTY_PAGE,
      counts: { all: 0, low: 0, out: 0, negative: 0 },
    } as unknown as Awaited<ReturnType<typeof listProducts>>);
    const { container } = render(
      await ProductsPage({ searchParams: Promise.resolve({}) }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Sản phẩm" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Danh mục hàng hóa")).toHaveClass("eyebrow");
    emptyState(container, "Chưa có sản phẩm nào");
  });

  it("bao khong tim thay (khong phai cua hang trong) khi tim kiem khong khop", async () => {
    vi.mocked(listProductCategories).mockResolvedValue([]);
    vi.mocked(findEditableProduct).mockResolvedValue(null);
    vi.mocked(listProducts).mockResolvedValue({
      ...EMPTY_PAGE,
      counts: { all: 0, low: 0, out: 0, negative: 0 },
    } as unknown as Awaited<ReturnType<typeof listProducts>>);
    const { container } = render(
      await ProductsPage({ searchParams: Promise.resolve({ q: "khong-co" }) }),
    );
    emptyState(
      container,
      "Không tìm thấy sản phẩm nào khớp với điều kiện lọc.",
    );
    expect(screen.queryByText("Chưa có sản phẩm nào")).not.toBeInTheDocument();
  });
});

describe("/admin/categories", () => {
  it("dung PageHeader va EmptyState khi chua co danh muc", async () => {
    vi.mocked(prisma.category.findMany).mockResolvedValue([]);
    vi.mocked(prisma.category.count).mockResolvedValue(0);
    const { container } = render(
      await CategoriesPage({ searchParams: Promise.resolve({}) }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Danh mục" }),
    ).toBeInTheDocument();
    emptyState(container, "Chưa có danh mục nào");
  });
});

describe("/admin/promotions", () => {
  it("chua co chien dich thi hien EmptyState", async () => {
    vi.mocked(prisma.storefrontPromotion.findMany).mockResolvedValue([]);
    vi.mocked(prisma.storefrontPromotion.count).mockResolvedValue(0);
    const { container } = render(
      await AdminPromotionsPage({ searchParams: Promise.resolve({}) }),
    );
    emptyState(container, "Chưa có chiến dịch khuyến mãi nào");
  });
});

describe("admin catalog page navigation", () => {
  it("preserves category movement across page boundaries and uses the global total when adding", async () => {
    vi.mocked(prisma.category.count).mockResolvedValue(42);
    vi.mocked(prisma.category.findMany).mockResolvedValue([
      {
        id: "c21",
        name: "Danh mục 21",
        slug: null,
        sortOrder: 21,
        _count: { products: 3 },
      },
      {
        id: "c22",
        name: "Danh mục 22",
        slug: null,
        sortOrder: 22,
        _count: { products: 0 },
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.category.findMany>>);
    const { container } = render(
      await CategoriesPage({
        searchParams: Promise.resolve({ page: "2", view: "all" }),
      }),
    );
    expect(
      screen.getByRole("button", { name: "Đưa Danh mục 21 lên trên" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Đưa Danh mục 22 xuống dưới" }),
    ).toBeEnabled();
    expect(screen.getByText("Danh sách (42)")).toBeInTheDocument();
    expect(container.querySelector('input[name="sortOrder"]')).toHaveValue(
      "43",
    );
    expect(screen.getByRole("link", { name: "Trang trước" })).toHaveAttribute(
      "href",
      "/admin/categories?view=all&page=1",
    );
    expect(screen.getByRole("link", { name: "Trang sau" })).toHaveAttribute(
      "href",
      "/admin/categories?view=all&page=3",
    );
  });

  it("campaign navigation shows the global count and retains query parameters", async () => {
    vi.mocked(prisma.storefrontPromotion.count).mockResolvedValue(42);
    vi.mocked(prisma.storefrontPromotion.findMany).mockResolvedValue([]);
    render(
      await AdminPromotionsPage({
        searchParams: Promise.resolve({ page: "2", view: "all" }),
      }),
    );
    expect(screen.getByText("Danh sách chiến dịch (42)")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trang sau" })).toHaveAttribute(
      "href",
      "/admin/promotions?view=all&page=3",
    );
    expect(screen.getByText("Trang 2/3")).toBeInTheDocument();
  });
});

describe("/admin/reports", () => {
  it("chuyển báo cáo cũ về tổng quan với kỳ mặc định", async () => {
    await expect(ReportsPage()).rejects.toThrow("NEXT_REDIRECT:/admin?days=14");
  });
});

describe("/admin/orders/[id]", () => {
  it("dung PageHeader voi ma don la tieu de cap 1", async () => {
    vi.mocked(prisma.order.findUnique).mockResolvedValue({
      id: "o1",
      code: "DH-102",
      status: "paid",
      channel: "pos",
      fulfillmentStatus: null,
      createdAt: new Date("2026-09-20T03:00:00Z"),
      subtotal: 150_000,
      discount: 0,
      total: 150_000,
      customer: null,
      items: [],
      payments: [],
    } as unknown as Awaited<ReturnType<typeof prisma.order.findUnique>>);
    render(await OrderDetailPage({ params: Promise.resolve({ id: "o1" }) }));
    expect(
      screen.getByRole("heading", { level: 1, name: "DH-102" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Chi tiết đơn hàng")).toHaveClass("eyebrow");
  });
});

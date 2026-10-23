import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import ProductsPage from "@/app/(management)/admin/products/page";
import { ToastProvider } from "@/components/ui/toast";
import { listProducts } from "@/server/admin/list-products";

vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ userId: "admin" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/server/admin/list-products", () => ({
  findEditableProduct: vi.fn().mockResolvedValue(null),
  isProductStockStatus: () => false,
  listProductCategories: vi.fn().mockResolvedValue([]),
  listProducts: vi.fn(),
}));

function product(id: string, name: string, stock: number, waiting: number) {
  return {
    id,
    name,
    aliases: null,
    sku: null,
    categoryId: null,
    unit: "chai",
    stock,
    price: 25_000,
    costPrice: null,
    imageUrl: null,
    category: { name: "Đồ uống" },
    waitingCount: waiting,
  };
}

it("cột Khách chờ hiện số khách đang chờ báo có hàng của từng sản phẩm", async () => {
  vi.mocked(listProducts).mockResolvedValue({
    items: [
      product("p-a", "Trà Đào Hết Hàng", 0, 2),
      product("p-b", "Nước Suối", 12, 0),
    ],
    total: 2,
    page: 1,
    pageSize: 50,
    counts: { all: 2, low: 0, out: 1, negative: 0, available: 1 },
  } as unknown as Awaited<ReturnType<typeof listProducts>>);

  render(
    <ToastProvider>
      {await ProductsPage({ searchParams: Promise.resolve({}) })}
    </ToastProvider>,
  );

  expect(
    screen.getByRole("columnheader", { name: "Khách chờ" }),
  ).toBeInTheDocument();

  const [waiting, none] = ["Trà Đào Hết Hàng", "Nước Suối"].map((name) =>
    screen
      .getAllByRole("row")
      .find((row) => within(row).queryByText(name) !== null),
  );
  const waitingCell = within(waiting!).getByTitle(
    "Khách đang chờ báo khi có hàng",
  );
  expect(waitingCell).toHaveTextContent("2 khách chờ báo có hàng");
  expect(
    within(none!).queryByTitle("Khách đang chờ báo khi có hàng"),
  ).not.toBeInTheDocument();
  expect(within(none!).getByText("—")).toBeInTheDocument();
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pagination } from "@/components/kit/pagination";

describe("Pagination", () => {
  it("hien trang hien tai/tong va giu cac tham so tim kiem khac", () => {
    render(
      <Pagination
        pathname="/admin/orders"
        page={2}
        pageSize={20}
        total={65}
        searchParams={{ q: "Lan", status: "paid", page: "2", edit: undefined }}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Phân trang" });
    expect(nav).toHaveTextContent("Trang 2/4");
    expect(screen.getByRole("link", { name: "Trang trước" })).toHaveAttribute(
      "href",
      "/admin/orders?q=Lan&status=paid&page=1",
    );
    expect(screen.getByRole("link", { name: "Trang sau" })).toHaveAttribute(
      "href",
      "/admin/orders?q=Lan&status=paid&page=3",
    );
  });

  it("khoa nut o trang dau va trang cuoi", () => {
    const { rerender } = render(
      <Pagination pathname="/admin/debts" page={1} pageSize={50} total={120} />,
    );
    expect(screen.queryByRole("link", { name: "Trang trước" })).toBeNull();
    expect(screen.getByText("Trang trước")).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    rerender(
      <Pagination pathname="/admin/debts" page={3} pageSize={50} total={120} />,
    );
    expect(screen.queryByRole("link", { name: "Trang sau" })).toBeNull();
    expect(screen.getByRole("link", { name: "Trang trước" })).toHaveAttribute(
      "href",
      "/admin/debts?page=2",
    );
  });

  it("khong hien khi chi co mot trang", () => {
    const { container } = render(
      <Pagination pathname="/admin/debts" page={1} pageSize={50} total={10} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

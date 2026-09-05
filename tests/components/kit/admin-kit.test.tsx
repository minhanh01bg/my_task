import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CollapsibleFormCard } from "@/components/kit/collapsible-form-card";
import { DataTableShell } from "@/components/kit/data-table-shell";
import { EmptyState } from "@/components/kit/empty-state";
import { PageHeader } from "@/components/kit/page-header";
import { StatTile } from "@/components/kit/stat-tile";

describe("PageHeader", () => {
  it("dat tieu de o cap do 1 cho trinh doc man hinh", () => {
    render(<PageHeader title="Sản phẩm" description="Quản lý hàng hoá" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Sản phẩm" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Quản lý hàng hoá")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("hien loi dan thay vi mot bang trong", () => {
    render(<EmptyState title="Chưa có sản phẩm nào" />);
    expect(screen.getByText("Chưa có sản phẩm nào")).toBeInTheDocument();
  });
});

describe("DataTableShell", () => {
  it("co du lieu thi hien bang, khong hien trang thai rong", () => {
    render(
      <DataTableShell
        title="Danh sách"
        count={2}
        isEmpty={false}
        empty={<EmptyState title="Chưa có gì" />}
      >
        <table>
          <tbody>
            <tr>
              <td>Bugi Wave</td>
            </tr>
          </tbody>
        </table>
      </DataTableShell>,
    );
    expect(screen.getByText("Danh sách (2)")).toBeInTheDocument();
    expect(screen.getByText("Bugi Wave")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có gì")).not.toBeInTheDocument();
  });

  it("rong thi hien trang thai rong thay cho bang", () => {
    render(
      <DataTableShell
        title="Danh sách"
        count={0}
        isEmpty
        empty={<EmptyState title="Chưa có gì" />}
      >
        <table>
          <tbody>
            <tr>
              <td>Bugi Wave</td>
            </tr>
          </tbody>
        </table>
      </DataTableShell>,
    );
    expect(screen.getByText("Chưa có gì")).toBeInTheDocument();
    expect(screen.queryByText("Bugi Wave")).not.toBeInTheDocument();
  });
});

describe("StatTile", () => {
  it("dinh dang tien khi format la money", () => {
    render(<StatTile label="Doanh thu" value={15000} format="money" />);
    expect(screen.getByText("15.000")).toBeInTheDocument();
  });

  it("mac dinh hien so tho", () => {
    render(<StatTile label="Số đơn" value={12} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});

describe("CollapsibleFormCard", () => {
  it("mac dinh dong de bang khong bi day xuong duoi", () => {
    render(
      <CollapsibleFormCard title="Thêm sản phẩm" triggerLabel="Thêm sản phẩm">
        <p>Nội dung form</p>
      </CollapsibleFormCard>,
    );
    // Base UI go han panel khoi DOM khi dong, khong phai chi an di.
    expect(screen.queryByText("Nội dung form")).not.toBeInTheDocument();
  });

  it("bam nut thi mo ra", async () => {
    render(
      <CollapsibleFormCard title="Thêm sản phẩm" triggerLabel="Thêm sản phẩm">
        <p>Nội dung form</p>
      </CollapsibleFormCard>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Thêm sản phẩm" }),
    );
    expect(screen.getByText("Nội dung form")).toBeVisible();
  });
});

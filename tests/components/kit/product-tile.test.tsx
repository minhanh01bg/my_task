import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductTile } from "@/components/kit/product-tile";
import { ResultRow } from "@/components/kit/result-list";

const product = {
  name: "Bugi Wave",
  price: 15000,
  unit: "cái",
  stock: 50,
  imageUrl: null,
};

describe("ProductTile", () => {
  it("hien ten, gia va ton kho", () => {
    render(<ProductTile {...product} onSelect={() => {}} />);
    expect(screen.getByText("Bugi Wave")).toBeInTheDocument();
    expect(screen.getByText("15.000")).toBeInTheDocument();
    expect(screen.getByText("Còn 50 cái")).toBeInTheDocument();
  });

  it("moi the deu cao bang nhau du ten dai ngan khac nhau", () => {
    const { container } = render(
      <ProductTile {...product} onSelect={() => {}} />,
    );
    expect(container.firstChild).toHaveClass("min-h-36");
  });

  it("goi onSelect khi bam", async () => {
    const onSelect = vi.fn();
    render(<ProductTile {...product} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

describe("ResultRow", () => {
  it("dong dang chon duoc danh dau cho trinh doc man hinh", () => {
    render(<ResultRow {...product} active onSelect={() => {}} />);
    expect(screen.getByRole("option")).toHaveAttribute("aria-selected", "true");
  });

  it("dong dang chon co thanh nhan ben trai", () => {
    render(<ResultRow {...product} active onSelect={() => {}} />);
    expect(screen.getByRole("option")).toHaveClass("border-l-primary");
  });

  it("dong khong duoc chon thi thanh nhan trong suot", () => {
    render(<ResultRow {...product} active={false} onSelect={() => {}} />);
    expect(screen.getByRole("option")).toHaveClass("border-l-transparent");
  });
});

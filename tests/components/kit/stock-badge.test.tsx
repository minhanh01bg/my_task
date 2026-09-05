import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  LOW_STOCK_THRESHOLD,
  StockBadge,
  stockLevel,
} from "@/components/kit/stock-badge";

describe("stockLevel", () => {
  it("nguong mac dinh la 5", () => {
    expect(LOW_STOCK_THRESHOLD).toBe(5);
  });

  it.each([
    [-1, "out"],
    [0, "out"],
    [0.5, "low"],
    [5, "low"],
    [5.0001, "ok"],
    [6, "ok"],
  ])("stock %s -> %s", (stock, expected) => {
    expect(stockLevel(stock)).toBe(expected);
  });

  it("nhan nguong tu ben ngoai", () => {
    expect(stockLevel(8, 10)).toBe("low");
    expect(stockLevel(11, 10)).toBe("ok");
  });
});

describe("StockBadge", () => {
  it("het hang thi noi 'Het hang', khong noi so", () => {
    render(<StockBadge stock={0} unit="cái" />);
    expect(screen.getByText("Hết hàng")).toBeInTheDocument();
  });

  it("ton am van la het hang, va hien so am de ke toan thay", () => {
    render(<StockBadge stock={-3} unit="cái" />);
    expect(screen.getByText("Hết hàng (-3)")).toBeInTheDocument();
  });

  it("con hang thi hien so kem don vi", () => {
    render(<StockBadge stock={50} unit="cái" />);
    expect(screen.getByText("Còn 50 cái")).toBeInTheDocument();
  });

  it("sap het thi doi mau canh bao", () => {
    const { container } = render(<StockBadge stock={2} unit="mét" />);
    expect(screen.getByText("Còn 2 mét")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bg-warning");
  });

  it("so thuc khong bi lam tron", () => {
    render(<StockBadge stock={2.5} unit="mét" />);
    expect(screen.getByText("Còn 2.5 mét")).toBeInTheDocument();
  });
});

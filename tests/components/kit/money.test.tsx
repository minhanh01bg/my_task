import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Money } from "@/components/kit/money";

describe("Money", () => {
  it("dinh dang so tien theo dinh dang VND", () => {
    render(<Money amount={15000} />);
    expect(screen.getByText("15.000")).toBeInTheDocument();
  });

  it("luon dung tabular-nums de cot so thang hang", () => {
    const { container } = render(<Money amount={1000} />);
    expect(container.firstChild).toHaveClass("tabular-nums");
  });

  it("co cach doc cho trinh doc man hinh", () => {
    render(<Money amount={15000} />);
    expect(screen.getByText("15.000")).toHaveAttribute("aria-label", "15.000");
  });

  it("size display to hon size base", () => {
    const { container: base } = render(<Money amount={1} size="base" />);
    const { container: display } = render(<Money amount={1} size="display" />);
    expect(base.firstChild).toHaveClass("text-base");
    expect(display.firstChild).toHaveClass("text-5xl");
  });
});

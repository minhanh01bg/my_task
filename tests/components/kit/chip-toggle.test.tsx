import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChipToggle } from "@/components/kit/chip-toggle";
import { TouchButton } from "@/components/kit/touch-button";

describe("TouchButton", () => {
  it("ep chieu cao toi thieu bang o cham", () => {
    render(<TouchButton>Thanh toán</TouchButton>);
    expect(screen.getByRole("button")).toHaveClass("min-h-touch");
  });
});

describe("ChipToggle", () => {
  it("dat chieu cao o cham de bam ngon tay trung", () => {
    render(<ChipToggle label="Tạp hoá" selected={false} onToggle={() => {}} />);
    expect(screen.getByRole("button")).toHaveClass("min-h-touch");
  });

  it("bao trang thai chon cho trinh doc man hinh", () => {
    render(<ChipToggle label="Tạp hoá" selected onToggle={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("goi onToggle khi bam", async () => {
    const onToggle = vi.fn();
    render(
      <ChipToggle label="Phụ tùng" selected={false} onToggle={onToggle} />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

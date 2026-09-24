import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { overlayClassName } from "@/components/ui/overlay";

function Demo({ side }: { side?: "right" | "bottom" }) {
  return (
    <Sheet>
      <SheetTrigger>Mở giỏ</SheetTrigger>
      <SheetContent side={side}>
        <SheetTitle>Giỏ hàng</SheetTitle>
        <SheetDescription>Các món đã chọn</SheetDescription>
      </SheetContent>
    </Sheet>
  );
}

describe("Sheet", () => {
  it("đóng mặc định, mở khi bấm trigger với tên lấy từ tiêu đề", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mở giỏ" }));

    const dialog = screen.getByRole("dialog", { name: "Giỏ hàng" });
    expect(dialog).toHaveAttribute("data-slot", "sheet-content");
    expect(dialog).toHaveAttribute("data-side", "right");
  });

  it("hỗ trợ side bottom", async () => {
    const user = userEvent.setup();
    render(<Demo side="bottom" />);
    await user.click(screen.getByRole("button", { name: "Mở giỏ" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("data-side", "bottom");
  });

  it("Escape đóng và trả focus về trigger", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByRole("button", { name: "Mở giỏ" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("nút đóng mặc định có nhãn tiếng Việt", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: "Mở giỏ" }));
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("lớp phủ dùng chung token với Dialog, không hard-code màu", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: "Mở giỏ" }));

    const overlay = document.querySelector('[data-slot="sheet-overlay"]');
    expect(overlay).not.toBeNull();
    for (const token of overlayClassName.split(" ")) {
      expect(overlay).toHaveClass(token);
    }
    expect(overlay?.className).not.toMatch(/bg-stone-/);
  });
});

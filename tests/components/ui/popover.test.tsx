import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

function Demo() {
  return (
    <>
      <Popover>
        <PopoverTrigger>Bộ lọc</PopoverTrigger>
        <PopoverContent>
          <PopoverTitle>Lọc đơn</PopoverTitle>
          <PopoverDescription>Chọn trạng thái</PopoverDescription>
        </PopoverContent>
      </Popover>
      <button type="button">Bên ngoài</button>
    </>
  );
}

describe("Popover", () => {
  it("mở khi bấm trigger", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    expect(screen.queryByText("Lọc đơn")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bộ lọc" }));

    const popup = screen.getByRole("dialog", { name: "Lọc đơn" });
    expect(popup).toHaveAttribute("data-slot", "popover-content");
  });

  it("Escape đóng và trả focus về trigger", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByRole("button", { name: "Bộ lọc" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("bấm ra ngoài thì đóng", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: "Bộ lọc" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Bên ngoài" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});

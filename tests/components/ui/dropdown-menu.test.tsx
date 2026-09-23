import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function Demo({ onEdit = vi.fn() }: { onEdit?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>Thao tác</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sản phẩm</DropdownMenuLabel>
          <DropdownMenuItem onClick={onEdit}>Sửa</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Xoá</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// userEvent trong jsdom khong phat PointerEvent day du (pointerType), nen
// trigger Base UI Menu duoc mo bang fireEvent.click hoac ban phim.
describe("DropdownMenu", () => {
  it("mở menu khi bấm trigger và liệt kê item", () => {
    render(<Demo />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Thao tác" }));

    expect(screen.getByRole("menu")).toHaveAttribute(
      "data-slot",
      "dropdown-menu-content",
    );
    expect(screen.getByRole("menuitem", { name: "Sửa" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Xoá" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
  });

  it("chọn item thì gọi handler và đóng menu", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<Demo onEdit={onEdit} />);
    screen.getByRole("button", { name: "Thao tác" }).focus();
    await user.keyboard("{Enter}");

    await user.click(screen.getByRole("menuitem", { name: "Sửa" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
  });

  it("Escape đóng và trả focus về trigger", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByRole("button", { name: "Thao tác" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });
});

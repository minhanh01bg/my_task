import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

describe("Dialog", () => {
  it("nút đóng có nhãn tiếng Việt và không dùng class tw-animate", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger>Mở</DialogTrigger>
        <DialogContent>
          <DialogTitle>Tiêu đề</DialogTitle>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    );
    await user.click(screen.getByRole("button", { name: "Mở" }));

    const dialog = screen.getByRole("dialog", { name: "Tiêu đề" });
    expect(dialog.className).not.toMatch(/animate-in|zoom-in|fade-in/);
    expect(screen.getAllByRole("button", { name: "Đóng" })).toHaveLength(2);

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});

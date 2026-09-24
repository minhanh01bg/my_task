import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function Demo() {
  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger aria-label="Giữ đơn">F8</TooltipTrigger>
        <TooltipContent>Giữ đơn hiện tại (F8)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

describe("Tooltip", () => {
  it("không hiện nội dung khi chưa rê chuột", () => {
    render(<Demo />);
    expect(screen.queryByText("Giữ đơn hiện tại (F8)")).not.toBeInTheDocument();
  });

  it("hiện khi rê chuột vào trigger", async () => {
    const user = userEvent.setup();
    render(<Demo />);

    await user.hover(screen.getByRole("button", { name: "Giữ đơn" }));

    const popup = await screen.findByText("Giữ đơn hiện tại (F8)");
    expect(popup.closest("[data-slot='tooltip-content']")).not.toBeNull();
  });

  it("Escape đóng tooltip", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.hover(screen.getByRole("button", { name: "Giữ đơn" }));
    await screen.findByText("Giữ đơn hiện tại (F8)");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByText("Giữ đơn hiện tại (F8)"),
      ).not.toBeInTheDocument(),
    );
  });
});

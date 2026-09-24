import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Switch } from "@/components/ui/switch";

describe("Switch", () => {
  it("render role switch với data-slot", () => {
    render(<Switch aria-label="Bán online" />);
    const control = screen.getByRole("switch", { name: "Bán online" });
    expect(control).toHaveAttribute("data-slot", "switch");
    expect(control).not.toBeChecked();
  });

  it("bấm hoặc Space thì bật/tắt và báo onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Switch aria-label="Bán online" onCheckedChange={onCheckedChange} />,
    );
    const control = screen.getByRole("switch", { name: "Bán online" });

    await user.click(control);
    expect(control).toBeChecked();
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());

    await user.keyboard(" ");
    expect(control).not.toBeChecked();
  });

  it("disabled thì không đổi", async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Bán online" disabled />);
    const control = screen.getByRole("switch", { name: "Bán online" });
    await user.click(control);
    expect(control).not.toBeChecked();
  });
});

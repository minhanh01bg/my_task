import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("render role checkbox với data-slot", () => {
    render(<Checkbox aria-label="Chọn tất cả" />);
    const box = screen.getByRole("checkbox", { name: "Chọn tất cả" });
    expect(box).toHaveAttribute("data-slot", "checkbox");
    expect(box).not.toBeChecked();
  });

  it("bấm thì chọn/bỏ chọn và báo onCheckedChange", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <Checkbox aria-label="Chọn tất cả" onCheckedChange={onCheckedChange} />,
    );
    const box = screen.getByRole("checkbox", { name: "Chọn tất cả" });

    await user.click(box);
    expect(box).toBeChecked();
    expect(onCheckedChange).toHaveBeenLastCalledWith(true, expect.anything());

    await user.keyboard(" ");
    expect(box).not.toBeChecked();
  });

  it("gắn với label qua id", async () => {
    const user = userEvent.setup();
    render(
      <label>
        <Checkbox /> Đồng ý điều khoản
      </label>,
    );
    await user.click(screen.getByText("Đồng ý điều khoản"));
    expect(screen.getByRole("checkbox")).toBeChecked();
  });
});

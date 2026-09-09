import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/shared/theme-toggle";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "light",
    resolvedTheme: "light",
    setTheme,
  }),
}));

describe("ThemeToggle", () => {
  it("hiển thị nút đổi giao diện sáng/tối và gọi setTheme khi bấm", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByRole("button", {
      name: /chuyển sang giao diện tối|đổi giao diện/i,
    });
    expect(button).toBeInTheDocument();

    await user.click(button);
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});

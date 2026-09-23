import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/shared/theme-toggle";

const setTheme = vi.fn();
let resolvedTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: resolvedTheme,
    resolvedTheme,
    setTheme,
  }),
}));

beforeEach(() => {
  setTheme.mockClear();
  resolvedTheme = "light";
});

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

  it("ở theme tối thì chuyển về sáng", async () => {
    resolvedTheme = "dark";
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(
      screen.getByRole("button", { name: "Chuyển sang giao diện sáng" }),
    );
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it.each([
    ["light", "text-foreground"],
    ["dark", "text-warning"],
  ])("icon ở theme %s dùng token %s", (theme, token) => {
    resolvedTheme = theme;
    const { container } = render(<ThemeToggle />);

    const icon = container.querySelector("svg");
    expect(icon).toHaveClass(token);
  });

  it("không hard-code màu Tailwind cho icon", () => {
    for (const theme of ["light", "dark"]) {
      resolvedTheme = theme;
      const { container, unmount } = render(<ThemeToggle />);
      const classes = container.querySelector("svg")?.getAttribute("class");
      expect(classes).not.toMatch(/amber-|slate-/);
      unmount();
    }
  });
});

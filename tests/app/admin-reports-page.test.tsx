import { describe, expect, it, vi } from "vitest";

import ReportsPage from "@/app/(management)/admin/reports/page";
import { requireAdminSession } from "@/server/auth/require-admin-session";

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));
vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn(),
}));

describe("legacy reports redirect", () => {
  it("chưa đăng nhập thì về /login thay vì tổng quan", async () => {
    vi.mocked(requireAdminSession).mockRejectedValueOnce(
      new Error("REDIRECT:/login"),
    );

    await expect(
      ReportsPage({ searchParams: Promise.resolve({ days: "7" }) }),
    ).rejects.toThrow("REDIRECT:/login");
    expect(requireAdminSession).toHaveBeenCalledWith({
      redirectToLogin: true,
    });
  });

  it.each([
    [undefined, 14],
    ["7", 7],
    ["14", 14],
    ["30", 30],
    ["99", 14],
  ])("days %s được giữ hoặc về 14 ngày", async (value, days) => {
    await expect(
      ReportsPage({ searchParams: Promise.resolve({ days: value }) }),
    ).rejects.toThrow(`REDIRECT:/admin?days=${days}`);
  });
});

import { describe, expect, it, vi } from "vitest";

import ReportsPage from "@/app/(management)/admin/reports/page";

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`);
  },
}));

describe("legacy reports redirect", () => {
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

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { togglePromotionActiveAction } from "@/app/(management)/admin/promotions/actions";
import { ToastProvider } from "@/components/ui/toast";
import { PromotionRowActions } from "@/features/admin-promotions/promotion-row-actions";

vi.mock("@/app/(management)/admin/promotions/actions", () => ({
  togglePromotionActiveAction: vi.fn(),
  deletePromotionAction: vi.fn(),
}));
beforeEach(() => vi.resetAllMocks());

it("notifies the admin after pausing a promotion", async () => {
  vi.mocked(togglePromotionActiveAction).mockResolvedValue({
    ok: true,
    message: "Đã tạm dừng khuyến mãi",
  });
  render(
    <ToastProvider>
      <PromotionRowActions id="p1" title="Ưu đãi" isActive />
    </ToastProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Tạm dừng" }));
  expect(await screen.findByText("Đã tạm dừng khuyến mãi")).toBeVisible();
  expect(togglePromotionActiveAction).toHaveBeenCalledWith("p1", false);
});

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SyncIndicator } from "@/components/pos/sync-indicator";
import { clearQueue, enqueueOrder } from "@/lib/sync/queue";
import type { OrderPayload } from "@/lib/sync/types";

const payload: OrderPayload = {
  clientId: "offline-1",
  channel: "pos",
  lines: [
    {
      productId: "p1",
      name: "Đường trắng",
      unitPrice: 15000,
      originalPrice: 15000,
      quantity: 1,
      discount: 0,
      unit: "kg",
      isService: false,
    },
  ],
  orderDiscount: 0,
  payments: [{ method: "cash", amount: 15000 }],
};

beforeEach(async () => {
  await clearQueue();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SyncIndicator", () => {
  it("hiện số đơn chờ ngay khi bán lúc mất mạng, không cần tải lại trang", async () => {
    render(<SyncIndicator />);

    await enqueueOrder(payload);

    expect(
      await screen.findByRole("button", { name: /1 đơn chờ đồng bộ/i }),
    ).toBeInTheDocument();
  });
});

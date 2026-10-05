import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineQueueManager } from "@/app/(management)/admin/offline/offline-queue-manager";
import {
  clearQueue,
  enqueueOrder,
  listQueuedOrders,
  removeQueuedOrder,
} from "@/lib/sync/queue";

beforeEach(async () => {
  await clearQueue();
  for (let i = 0; i < 21; i++) {
    const clientId = `local-page-${String(i).padStart(2, "0")}`;
    await enqueueOrder({
      clientId,
      channel: "pos",
      lines: [],
      orderDiscount: 0,
      payments: [{ method: "cash", amount: 1000 }],
    });
  }
});
afterEach(() => vi.unstubAllGlobals());

describe("offline recovery pagination", () => {
  it("keeps every paid order in IndexedDB while paging and clamps when the last page disappears", async () => {
    render(<OfflineQueueManager />);
    await screen.findByText("Mã thiết bị: local-page-00");
    expect(screen.getAllByRole("button", { name: "Gửi lại" })).toHaveLength(20);
    expect(
      screen.queryByText("Mã thiết bị: local-page-20"),
    ).not.toBeInTheDocument();
    expect(await listQueuedOrders()).toHaveLength(21);
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    await screen.findByText("Mã thiết bị: local-page-20");
    expect(
      screen.queryByText("Mã thiết bị: local-page-00"),
    ).not.toBeInTheDocument();
    await removeQueuedOrder("local-page-20");
    await screen.findByText("Mã thiết bị: local-page-00");
    expect(screen.getAllByRole("button", { name: "Gửi lại" })).toHaveLength(20);
  });

  it("retrying an order on page two sends that order and preserves failures", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "Cần kiểm tra" }),
    });
    vi.stubGlobal("fetch", fetchSpy);
    render(<OfflineQueueManager />);
    await screen.findByText("Mã thiết bị: local-page-00");
    fireEvent.click(screen.getByRole("button", { name: "Trang sau" }));
    const text = await screen.findByText("Mã thiết bị: local-page-20");
    fireEvent.click(
      within(text.closest("li")!).getByRole("button", { name: "Gửi lại" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Cần kiểm tra"),
    );
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).clientId).toBe(
      "local-page-20",
    );
    expect(await listQueuedOrders()).toHaveLength(21);
  });
});

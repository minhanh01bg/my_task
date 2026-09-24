import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OfflineQueueManager } from "@/app/admin/offline/offline-queue-manager";

vi.mock("@/lib/sync/queue", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/sync/queue")>()),
  listQueuedOrders: vi.fn().mockResolvedValue([]),
}));

describe("OfflineQueueManager", () => {
  it("khong co don ket thi hien EmptyState chung cua kit", async () => {
    render(<OfflineQueueManager />);
    const title = await screen.findByText("Không có đơn bị kẹt");
    expect(title.closest('[data-slot="empty-state"]')).not.toBeNull();
  });
});

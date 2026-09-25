import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AccountStatusBadge,
  ActiveStatusBadge,
  ReviewStatusBadge,
  VoucherStatusBadge,
} from "@/components/kit/status-badge";

describe("status-badge kit templates", () => {
  it("renders ActiveStatusBadge with default and custom labels", () => {
    const { rerender } = render(<ActiveStatusBadge active={true} />);
    expect(screen.getByText("Đang bật")).toBeInTheDocument();

    rerender(<ActiveStatusBadge active={false} />);
    expect(screen.getByText("Đã tắt")).toBeInTheDocument();

    rerender(
      <ActiveStatusBadge
        active={true}
        activeLabel="Đang hoạt động"
        inactiveLabel="Tạm dừng"
      />,
    );
    expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();

    rerender(
      <ActiveStatusBadge
        active={false}
        activeLabel="Đang hoạt động"
        inactiveLabel="Tạm dừng"
      />,
    );
    expect(screen.getByText("Tạm dừng")).toBeInTheDocument();
  });

  it("renders AccountStatusBadge for locked and active accounts", () => {
    const { rerender } = render(<AccountStatusBadge disabled={false} />);
    expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();

    rerender(<AccountStatusBadge disabled={true} />);
    expect(screen.getByText("Đã khóa")).toBeInTheDocument();
  });

  it("renders ReviewStatusBadge for published and hidden reviews", () => {
    const { rerender } = render(<ReviewStatusBadge status="published" />);
    expect(screen.getByText("Đang hiển thị")).toBeInTheDocument();

    rerender(<ReviewStatusBadge status="hidden" />);
    expect(screen.getByText("Đã ẩn")).toBeInTheDocument();
  });

  it("renders VoucherStatusBadge across different voucher lifecycle states", () => {
    // 1. Inactive
    const { rerender } = render(
      <VoucherStatusBadge
        voucher={{
          isActive: false,
          startsAt: null,
          endsAt: null,
          maxUses: 10,
          usedCount: 0,
        }}
      />,
    );
    expect(screen.getByText("Đã tắt")).toBeInTheDocument();

    // 2. Expired
    const past = new Date(Date.now() - 3600_000);
    rerender(
      <VoucherStatusBadge
        voucher={{
          isActive: true,
          startsAt: null,
          endsAt: past,
          maxUses: 10,
          usedCount: 0,
        }}
      />,
    );
    expect(screen.getByText("Hết hạn")).toBeInTheDocument();

    // 3. Max uses reached
    const future = new Date(Date.now() + 3600_000);
    rerender(
      <VoucherStatusBadge
        voucher={{
          isActive: true,
          startsAt: null,
          endsAt: future,
          maxUses: 10,
          usedCount: 10,
        }}
      />,
    );
    expect(screen.getByText("Hết lượt")).toBeInTheDocument();

    // 4. Upcoming
    const later = new Date(Date.now() + 7200_000);
    rerender(
      <VoucherStatusBadge
        voucher={{
          isActive: true,
          startsAt: later,
          endsAt: null,
          maxUses: 10,
          usedCount: 0,
        }}
      />,
    );
    expect(screen.getByText("Sắp diễn ra")).toBeInTheDocument();

    // 5. Active & Running
    rerender(
      <VoucherStatusBadge
        voucher={{
          isActive: true,
          startsAt: null,
          endsAt: future,
          maxUses: 100,
          usedCount: 5,
        }}
      />,
    );
    expect(screen.getByText("Đang chạy")).toBeInTheDocument();
  });
});

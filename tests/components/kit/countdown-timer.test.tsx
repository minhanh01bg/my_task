import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CountdownTimer } from "@/components/kit/countdown-timer";

describe("CountdownTimer Component", () => {
  it("render đồng hồ đếm ngược với các khối giờ, phút, giây", () => {
    // Target time: 2 hours, 30 minutes, 15 seconds in future
    const target = new Date(Date.now() + (2 * 3600 + 30 * 60 + 15) * 1000);

    render(<CountdownTimer targetDate={target} />);

    // Phải hiển thị các nhãn thời gian hoặc khối số
    expect(screen.getByText("Giờ")).toBeInTheDocument();
    expect(screen.getByText("Phút")).toBeInTheDocument();
    expect(screen.getByText("Giây")).toBeInTheDocument();
  });

  it("hiển thị thông báo khi thời gian đã hết", () => {
    // Target time in the past
    const pastTarget = new Date(Date.now() - 10000);
    render(
      <CountdownTimer
        targetDate={pastTarget}
        expiredMessage="Đã kết thúc phiên"
      />,
    );
    expect(screen.getByText("Đã kết thúc phiên")).toBeInTheDocument();
  });
});

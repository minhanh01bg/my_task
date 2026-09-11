import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartSvg } from "@/components/kit/chart-svg";

describe("ChartSvg component", () => {
  const sampleData = [
    { label: "T2", value: 1_200_000 },
    { label: "T3", value: 2_500_000 },
    { label: "T4", value: 1_800_000 },
    { label: "T5", value: 3_200_000 },
    { label: "T6", value: 4_500_000 },
    { label: "T7", value: 6_000_000 },
    { label: "CN", value: 5_100_000 },
  ];

  it("render biểu đồ SVG với đầy đủ các nhãn thời gian", () => {
    render(
      <ChartSvg
        data={sampleData}
        title="Doanh thu tuần này"
        formatValue={(v) => `${(v / 1_000_000).toFixed(1)}Tr`}
      />,
    );

    expect(screen.getByText("Doanh thu tuần này")).toBeInTheDocument();
    expect(screen.getByText("T2")).toBeInTheDocument();
    expect(screen.getByText("CN")).toBeInTheDocument();
    expect(screen.getByTestId("chart-svg-root")).toBeInTheDocument();
  });

  it("xử lý an toàn khi tập dữ liệu rỗng", () => {
    render(<ChartSvg data={[]} title="Chưa có dữ liệu" />);

    expect(screen.getByText("Chưa có dữ liệu")).toBeInTheDocument();
    expect(screen.getByText(/không có dữ liệu/i)).toBeInTheDocument();
  });
});

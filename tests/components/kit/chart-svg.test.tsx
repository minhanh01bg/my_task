import { fireEvent, render, screen } from "@testing-library/react";
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

  it("hỗ trợ valueFormat dạng chuỗi serializable tương thích React Server Components", () => {
    const { container } = render(
      <ChartSvg data={sampleData} title="Xu hướng" valueFormat="vnd-k" />,
    );

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(sampleData.length);

    fireEvent.mouseEnter(circles[0]);
    expect(screen.getByText(/1\.200k ₫/)).toBeInTheDocument();
  });

  it("vẽ hai series với chú thích khi có secondaryValue", () => {
    const { container } = render(
      <ChartSvg
        data={[
          { label: "01", value: 100_000, secondaryValue: 50_000 },
          { label: "02", value: 200_000, secondaryValue: 0 },
          { label: "03", value: 0, secondaryValue: 300_000 },
        ]}
        seriesLabels={["Tại quầy", "Online"]}
        valueFormat="vnd-k"
      />,
    );

    expect(container.querySelectorAll("[data-series]")).toHaveLength(2);
    expect(screen.getByText("Tại quầy")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();

    const circles = container.querySelectorAll("circle");
    expect(circles.length).toBe(6);
    fireEvent.mouseEnter(circles[0]);
    expect(screen.getByText(/100k ₫/)).toBeInTheDocument();
    expect(screen.getByText(/50k ₫/)).toBeInTheDocument();
  });

  it("thưa nhãn trục ngang khi nhiều điểm (30 ngày)", () => {
    const data = Array.from({ length: 30 }, (_, i) => ({
      label: String(i + 1).padStart(2, "0"),
      value: i * 1000,
    }));
    render(<ChartSvg data={data} />);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.queryByText("02")).not.toBeInTheDocument();
  });
});

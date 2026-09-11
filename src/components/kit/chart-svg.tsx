"use client";

import { useId, useState } from "react";

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartSvgProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
  formatValue?: (v: number) => string;
  height?: number;
  className?: string;
}

export function ChartSvg({
  data,
  title,
  subtitle,
  formatValue = (v) => v.toLocaleString("vi-VN"),
  height = 220,
  className = "",
}: ChartSvgProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div
        data-testid="chart-svg-root"
        className={`surface-panel rounded-2xl border p-5 ${className}`}
      >
        {title && <h3 className="text-base font-bold">{title}</h3>}
        {subtitle && (
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        )}
        <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
          Không có dữ liệu hiển thị
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const width = 600;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const points = data.map((d, index) => {
    const x = paddingX + (index / Math.max(data.length - 1, 1)) * chartWidth;
    const y = paddingY + chartHeight - (d.value / maxValue) * chartHeight;
    return { x, y, data: d };
  });

  // Generate SVG path for line
  const pathD = points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x},${point.y}`;
    const prev = points[index - 1];
    const cpX1 = prev.x + (point.x - prev.x) / 2;
    const cpY1 = prev.y;
    const cpX2 = prev.x + (point.x - prev.x) / 2;
    const cpY2 = point.y;
    return `${acc} C ${cpX1},${cpY1} ${cpX2},${cpY2} ${point.x},${point.y}`;
  }, "");

  // Generate SVG path for area fill
  const areaD = `${pathD} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

  return (
    <div
      data-testid="chart-svg-root"
      className={`surface-panel rounded-2xl border p-5 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          {title && (
            <h3 className="text-foreground text-base font-bold">{title}</h3>
          )}
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>
          )}
        </div>
        {hoverIndex !== null && points[hoverIndex] && (
          <div className="text-right">
            <span className="text-muted-foreground text-xs">
              {points[hoverIndex].data.label}:{" "}
            </span>
            <span className="text-primary text-sm font-bold">
              {formatValue(points[hoverIndex].data.value)}
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.35" />
              <stop
                offset="100%"
                stopColor="var(--primary)"
                stopOpacity="0.0"
              />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingY + chartHeight * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
                strokeDasharray="4 4"
              />
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Smooth Line */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((point, index) => {
            const isHovered = hoverIndex === index;
            return (
              <g
                key={index}
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? "6" : "4"}
                  className="fill-background stroke-primary transition-all"
                  strokeWidth={isHovered ? "3" : "2"}
                />
              </g>
            );
          })}
        </svg>

        {/* Labels below chart */}
        <div
          className="text-muted-foreground flex justify-between pt-2 text-xs"
          style={{
            paddingLeft: `${(paddingX / width) * 100}%`,
            paddingRight: `${(paddingX / width) * 100}%`,
          }}
        >
          {data.map((d, index) => (
            <span
              key={index}
              className={`text-center font-medium ${
                hoverIndex === index ? "text-primary font-bold" : ""
              }`}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

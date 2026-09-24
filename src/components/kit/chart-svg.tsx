"use client";

import { useId, useState } from "react";

export interface ChartDataPoint {
  label: string;
  value: number;
  /** Series thu hai (tuy chon) — ve khi co `seriesLabels`. */
  secondaryValue?: number;
}

export interface ChartSvgProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
  valueFormat?: "vnd" | "vnd-k" | "number";
  formatValue?: (v: number) => string;
  height?: number;
  className?: string;
  /** Ten hai series [chinh, phu]; co thi ve them duong `secondaryValue` va chu thich. */
  seriesLabels?: [string, string];
}

/** Qua nhieu nhan truc ngang (30 ngay) se chong len nhau — chi hien ~10 nhan. */
const MAX_AXIS_LABELS = 14;

function smoothPath(points: Array<{ x: number; y: number }>): string {
  return points.reduce((acc, point, index) => {
    if (index === 0) return `M ${point.x},${point.y}`;
    const prev = points[index - 1];
    const cpX = prev.x + (point.x - prev.x) / 2;
    return `${acc} C ${cpX},${prev.y} ${cpX},${point.y} ${point.x},${point.y}`;
  }, "");
}

export function ChartSvg({
  data,
  title,
  subtitle,
  valueFormat,
  formatValue,
  height = 220,
  className = "",
  seriesLabels,
}: ChartSvgProps) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const formatDisplayValue = (val: number): string => {
    if (formatValue) {
      return formatValue(val);
    }
    if (valueFormat === "vnd-k") {
      return `${(val / 1_000).toLocaleString("vi-VN")}k ₫`;
    }
    if (valueFormat === "vnd") {
      return `${val.toLocaleString("vi-VN")} ₫`;
    }
    return val.toLocaleString("vi-VN");
  };

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

  const twoSeries = seriesLabels !== undefined;
  const maxValue = Math.max(
    ...data.map((d) =>
      twoSeries ? Math.max(d.value, d.secondaryValue ?? 0) : d.value,
    ),
    1,
  );
  const width = 600;
  const paddingX = 40;
  const paddingY = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const xAt = (index: number) =>
    paddingX + (index / Math.max(data.length - 1, 1)) * chartWidth;
  const yAt = (value: number) =>
    paddingY + chartHeight - (value / maxValue) * chartHeight;

  const points = data.map((d, index) => ({
    x: xAt(index),
    y: yAt(d.value),
    data: d,
  }));
  const secondaryPoints = twoSeries
    ? data.map((d, index) => ({ x: xAt(index), y: yAt(d.secondaryValue ?? 0) }))
    : [];

  const pathD = smoothPath(points);
  const secondaryPathD = twoSeries ? smoothPath(secondaryPoints) : "";

  // Generate SVG path for area fill
  const areaD = `${pathD} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

  const labelStep =
    data.length > MAX_AXIS_LABELS ? Math.ceil(data.length / 10) : 1;
  const hovered = hoverIndex !== null ? points[hoverIndex] : undefined;

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
        {hovered && (
          <div className="text-right">
            <span className="text-muted-foreground text-xs">
              {hovered.data.label}:{" "}
            </span>
            {twoSeries ? (
              <>
                <span className="text-muted-foreground text-xs">
                  {seriesLabels[0]}{" "}
                </span>
                <span className="text-primary text-sm font-bold">
                  {formatDisplayValue(hovered.data.value)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {" · "}
                  {seriesLabels[1]}{" "}
                </span>
                <span className="text-chart-3 text-sm font-bold">
                  {formatDisplayValue(hovered.data.secondaryValue ?? 0)}
                </span>
              </>
            ) : (
              <span className="text-primary text-sm font-bold">
                {formatDisplayValue(hovered.data.value)}
              </span>
            )}
          </div>
        )}
      </div>

      {twoSeries ? (
        <ul className="text-muted-foreground mb-2 flex flex-wrap gap-4 text-xs font-medium">
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="bg-primary inline-block h-0.5 w-4 rounded-full"
            />
            {seriesLabels[0]}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="bg-chart-3 inline-block h-0.5 w-4 rounded-full"
            />
            {seriesLabels[1]}
          </li>
        </ul>
      ) : null}

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
            data-series={twoSeries ? "primary" : undefined}
            d={pathD}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {twoSeries ? (
            <path
              data-series="secondary"
              d={secondaryPathD}
              fill="none"
              stroke="var(--chart-3)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

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
                  className="fill-background stroke-primary transition-[r,stroke-width]"
                  strokeWidth={isHovered ? "3" : "2"}
                />
              </g>
            );
          })}
          {secondaryPoints.map((point, index) => {
            const isHovered = hoverIndex === index;
            return (
              <g
                key={`secondary-${index}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isHovered ? "6" : "4"}
                  className="fill-background stroke-chart-3 transition-[r,stroke-width]"
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
              {index % labelStep === 0 || index === data.length - 1
                ? d.label
                : null}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  path.resolve(__dirname, "../../src/app/globals.css"),
  "utf8",
);

describe("animation tokens and micro-interactions in globals.css", () => {
  it("định nghĩa keyframe và utility class animate-shimmer cho skeleton loader", () => {
    expect(css).toContain("@keyframes shimmer");
    expect(css).toContain(".animate-shimmer");
  });

  it("định nghĩa keyframe và utility class animate-badge-bounce cho tương tác giỏ hàng", () => {
    expect(css).toContain("@keyframes badge-bounce");
    expect(css).toContain(".animate-badge-bounce");
  });

  it("định nghĩa keyframe và utility class animate-pulse-subtle cho các thông báo / hot badge", () => {
    expect(css).toContain("@keyframes pulse-subtle");
    expect(css).toContain(".animate-pulse-subtle");
  });

  it("định nghĩa utility class card-interactive với hiệu ứng nâng thẻ mượt mà và bóng đổ", () => {
    expect(css).toContain(".card-interactive");
    expect(css).toContain("translateY(-4px)");
  });

  it("định nghĩa utility class btn-press cho phản hồi xúc giác khi bấm nút", () => {
    expect(css).toContain(".btn-press");
    expect(css).toContain("scale-[0.97]");
  });

  it("định nghĩa animation slide-in-right cho slide-over cart drawer", () => {
    expect(css).toContain("@keyframes slide-in-right");
    expect(css).toContain(".animate-slide-in-right");
  });

  it("tôn trọng người dùng bật prefers-reduced-motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important");
  });
});

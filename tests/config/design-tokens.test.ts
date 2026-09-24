import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { compile } from "tailwindcss";
import { describe, expect, it } from "vitest";

import { ResultList, ResultRow, TouchButton } from "@/components/kit";

const root = path.resolve(__dirname, "../..");
const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

/**
 * Bien dich globals.css bang Tailwind that (bo tw-animate-css, khong can cho
 * utility dang kiem) roi tra CSS sinh ra cho cac class can hoi.
 */
async function buildUtilities(candidates: string[]): Promise<string> {
  const source = css
    .replace('@import "tailwindcss";', '@import "tailwindcss/index.css";')
    .replace('@import "tw-animate-css";', "");
  const compiler = await compile(source, {
    base: root,
    loadStylesheet: async (id, base) => {
      const file = path.join(root, "node_modules", id);
      return { path: file, base, content: readFileSync(file, "utf8") };
    },
  });
  return compiler.build(candidates);
}

/** Lay noi dung mot block CSS top-level theo selector, vd ":root", ".dark". */
function block(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`Khong tim thay block ${selector}`);
  const end = css.indexOf("\n}", start + 1);
  return css.slice(start, end);
}

function tokens(selector: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of block(selector).split("\n")) {
    const match = line.match(/^\s*(--[\w-]+)\s*:\s*(.+);\s*$/);
    if (match) map.set(match[1], match[2]);
  }
  return map;
}

/** Tach oklch(L C H) thanh so; tra null neu khong phai oklch ba thanh phan. */
function oklch(value: string | undefined) {
  const match = value?.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!match) return null;
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

const light = tokens(":root");
const dark = tokens(".dark");
const theme = tokens("@theme inline");

const CHARTS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

const SHARED = [
  "--background",
  "--card",
  "--primary",
  "--accent",
  "--destructive",
  "--destructive-foreground",
  "--ring",
  "--sidebar-primary",
  "--success",
  "--success-foreground",
  "--warning",
  "--warning-foreground",
  "--info",
  "--info-foreground",
  ...CHARTS,
];

describe("design tokens — light va dark cung thuong hieu", () => {
  it.each(SHARED)("%s co o ca :root lan .dark", (token) => {
    expect(light.has(token)).toBe(true);
    expect(dark.has(token)).toBe(true);
  });

  it("giu moi ten token cua light trong dark (tru token khong doi theo theme)", () => {
    const themeless = new Set(["--radius", "--touch-target"]);
    for (const name of light.keys()) {
      if (themeless.has(name)) continue;
      expect(dark.has(name), `${name} thieu trong .dark`).toBe(true);
    }
  });

  it("nen dark am, khong con xam trung tinh", () => {
    expect(dark.get("--background")).toBe("oklch(0.17 0.01 60)");
    expect(oklch(dark.get("--card"))?.l).toBe(0.21);
    expect(oklch(dark.get("--card"))?.c).toBeGreaterThan(0);
  });

  it("primary dark cung hue voi light nhung sang hon (~0.7 L)", () => {
    const lightPrimary = oklch(light.get("--primary"));
    const darkPrimary = oklch(dark.get("--primary"));
    expect(darkPrimary?.h).toBe(lightPrimary?.h);
    expect(darkPrimary?.l).toBeGreaterThanOrEqual(0.68);
    expect(darkPrimary?.l).toBeLessThanOrEqual(0.74);
  });

  it("accent dark la amber", () => {
    const accent = oklch(dark.get("--accent"));
    expect(accent?.h).toBeGreaterThanOrEqual(60);
    expect(accent?.h).toBeLessThanOrEqual(85);
    expect(accent?.c).toBeGreaterThan(0.05);
  });

  it("ring va sidebar-primary cua dark trung primary", () => {
    expect(dark.get("--ring")).toBe(dark.get("--primary"));
    expect(dark.get("--sidebar-primary")).toBe(dark.get("--primary"));
  });

  it.each([
    ["light", light],
    ["dark", dark],
  ] as const)("5 mau chart phan biet ro o theme %s", (_name, map) => {
    const colors = CHARTS.map((token) => oklch(map.get(token)));
    for (const color of colors) {
      expect(color).not.toBeNull();
      expect(color!.c).toBeGreaterThan(0.05);
    }
    const hues = colors.map((color) => color!.h);
    for (let i = 0; i < hues.length; i += 1) {
      for (let j = i + 1; j < hues.length; j += 1) {
        const diff = Math.abs(hues[i] - hues[j]);
        expect(Math.min(diff, 360 - diff)).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("success/warning/info co bien the rieng cho dark", () => {
    for (const token of ["--success", "--warning", "--info"]) {
      expect(dark.get(token)).not.toBe(light.get(token));
    }
  });
});

describe("@theme inline", () => {
  it("dua --touch-target vao spacing de sinh min-h-touch/size-touch", () => {
    expect(theme.get("--spacing-touch")).toBe("2.75rem");
  });

  it("anh xa --destructive-foreground thanh mau Tailwind", () => {
    expect(theme.get("--color-destructive-foreground")).toBe(
      "var(--destructive-foreground)",
    );
  });
});

describe("touch target 44px", () => {
  it("Tailwind sinh min-h-touch va size-touch = 2.75rem", async () => {
    const out = await buildUtilities(["min-h-touch", "size-touch"]);
    expect(out).toMatch(/\.min-h-touch\s*\{\s*min-height:\s*2\.75rem/);
    expect(out).toMatch(
      /\.size-touch\s*\{\s*width:\s*2\.75rem;\s*height:\s*2\.75rem/,
    );
  });

  it("TouchButton va ResultRow dung class min-h-touch", () => {
    render(createElement(TouchButton, null, "Thanh toán"));
    render(
      createElement(
        ResultList,
        null,
        createElement(ResultRow, {
          name: "Nhớt Castrol",
          price: 120000,
          stock: 12,
          unit: "chai",
          active: false,
          onSelect: () => {},
        }),
      ),
    );
    expect(screen.getByRole("button", { name: "Thanh toán" })).toHaveClass(
      "min-h-touch",
    );
    expect(screen.getByRole("button", { name: /Nhớt Castrol/ })).toHaveClass(
      "min-h-touch",
    );
  });
});

describe("utilities", () => {
  it("khong dinh nghia lai .animate-in cua tw-animate-css", () => {
    expect(css).toContain('@import "tw-animate-css"');
    expect(css).not.toMatch(/^\s*\.animate-in\s*[{,]/m);
  });

  it("gradient nen chi o light, dark dung nen phang", () => {
    expect(css).toMatch(/\.dark body\s*\{[^}]*background-image:\s*none/);
  });
});

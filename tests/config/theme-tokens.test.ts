import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(
  path.resolve(__dirname, "../../src/app/globals.css"),
  "utf8",
);

/** Lay noi dung mot block CSS theo selector, vd ":root" hoac ".dark". */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Khong tim thay block ${selector}`);
  const end = css.indexOf("\n}", start);
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

const SEMANTIC = [
  "--primary",
  "--primary-foreground",
  "--success",
  "--success-foreground",
  "--warning",
  "--warning-foreground",
  "--info",
  "--info-foreground",
];

describe("theme tokens", () => {
  const light = tokens(":root");
  const dark = tokens(".dark");

  it.each(SEMANTIC)("dinh nghia %s o ca light lan dark", (token) => {
    expect(light.has(token)).toBe(true);
    expect(dark.has(token)).toBe(true);
  });

  it("khong con la bang mau xam — primary phai co chroma", () => {
    // oklch(L C H) — C la so thu hai. Bang xam cu co C = 0 o moi token.
    const chroma = (value: string) =>
      Number(value.match(/oklch\(\s*[\d.]+\s+([\d.]+)/)?.[1] ?? "0");

    expect(chroma(light.get("--primary")!)).toBeGreaterThan(0.05);
    expect(chroma(dark.get("--primary")!)).toBeGreaterThan(0.05);
  });

  it("dinh nghia --touch-target dat 44px", () => {
    expect(light.get("--touch-target")).toBe("2.75rem");
  });
});

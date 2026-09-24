import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(entry) ? [full] : [];
  });
}

// design-system/an-phat-pos/MASTER.md: transition dung thuoc tinh cu the,
// khong nhac/phong to the tren luoi san pham khi hover.
describe("motion rules", () => {
  const files = sourceFiles(SRC);

  it("khong dung transition-all (liet ke thuoc tinh cu the)", () => {
    const offenders = files.filter((file) =>
      /transition-all\b/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([]);
  });

  it(".card-interactive chi doi bong/vien khi hover, khong translate", () => {
    const css = readFileSync(path.join(SRC, "app/globals.css"), "utf8");
    const hover = css.match(/\.card-interactive:hover\s*\{([^}]*)\}/);
    expect(hover?.[1]).toBeDefined();
    expect(hover![1]).not.toMatch(/transform|translate|scale/);
  });

  it("the danh muc tren landing khong nhac len khi hover", () => {
    const source = readFileSync(
      path.join(SRC, "features/online-store/landing/category-section.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/hover:-translate-y|group-hover:scale/);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const MANAGEMENT_DIR = path.resolve(__dirname, "../../src/app/(management)");

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return pageFiles(full);
    return entry === "page.tsx" ? [full] : [];
  });
}

// Layout không chặn page con render hay lộ RSC payload (doc Next "Layouts and
// auth checks"), nên mỗi page quản trị phải tự kiểm tra phiên trước khi đọc dữ liệu.
describe("page quản trị tự kiểm tra phiên", () => {
  const pages = pageFiles(MANAGEMENT_DIR).map((file) => ({
    file: path.relative(MANAGEMENT_DIR, file),
    source: readFileSync(file, "utf8"),
  }));

  it("quét được cả /pos và các page /admin", () => {
    expect(pages.map((page) => page.file)).toEqual(
      expect.arrayContaining([
        path.join("admin", "page.tsx"),
        path.join("admin", "customers", "page.tsx"),
        path.join("pos", "page.tsx"),
      ]),
    );
  });

  it("mọi page.tsx trong (management) đều gọi requireAdminSession", () => {
    const offenders = pages
      .filter(
        (page) =>
          !/await requireAdminSession\(\{\s*redirectToLogin: true\s*\}\)/.test(
            page.source,
          ),
      )
      .map((page) => page.file);

    expect(offenders).toEqual([]);
  });
});

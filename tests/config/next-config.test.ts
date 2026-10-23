import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return (await import("../../next.config")).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pnpm dev", () => {
  const devScript: string = JSON.parse(readFileSync("package.json", "utf8"))
    .scripts.dev;

  // pnpm chạy script bằng sh: thay `next dev` bằng printf để xem tham số thật.
  function devArgs(env: Record<string, string>) {
    const base = { ...process.env };
    delete base.DEV_HOST;
    return execFileSync(
      "sh",
      ["-c", devScript.replace(/^next dev\b/, "printf '%s\\n'")],
      { env: { ...base, ...env }, encoding: "utf8" },
    )
      .trim()
      .split("\n");
  }

  it("binds to loopback unless DEV_HOST is set", () => {
    const args = devArgs({});
    expect(args[args.indexOf("-H") + 1]).toBe("127.0.0.1");
    const lan = devArgs({ DEV_HOST: "0.0.0.0" });
    expect(lan[lan.indexOf("-H") + 1]).toBe("0.0.0.0");
  });
});

describe("next.config allowedDevOrigins", () => {
  it("only trusts loopback hosts by default", async () => {
    vi.stubEnv("DEV_ALLOWED_ORIGINS", "");
    const config = await loadConfig();
    expect(config.allowedDevOrigins).toEqual(["127.0.0.1", "localhost"]);
  });

  it("adds comma-separated hosts from DEV_ALLOWED_ORIGINS", async () => {
    vi.stubEnv("DEV_ALLOWED_ORIGINS", " 192.168.1.10, *.tunnel.example.com ,,");
    const config = await loadConfig();
    expect(config.allowedDevOrigins).toEqual([
      "127.0.0.1",
      "localhost",
      "192.168.1.10",
      "*.tunnel.example.com",
    ]);
  });
});

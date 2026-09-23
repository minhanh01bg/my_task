import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import {
  applySqlitePragmas,
  prisma,
  prismaReady,
  withSqliteConnectionLimit,
} from "@/server/db/prisma";

afterEach(() => {
  vi.restoreAllMocks();
});

async function readPragma(name: string): Promise<unknown> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `PRAGMA ${name};`,
  );
  return Object.values(rows[0] ?? {})[0];
}

describe("prisma runtime (SQLite)", () => {
  it("bat WAL va busy_timeout=5000 sau khi prismaReady xong", async () => {
    await prismaReady;

    expect(await readPragma("journal_mode")).toBe("wal");
    expect(Number(await readPragma("busy_timeout"))).toBe(5000);
  });

  it("moi truy van dong thoi deu thay pragma theo ket noi (pool 1 ket noi)", async () => {
    await prismaReady;

    // Truy van cham de cac request chong len nhau; neu pool mo nhieu ket noi,
    // ket noi moi se co synchronous mac dinh (FULL = 2) thay vi NORMAL (1).
    const slowPragmaProbe = `
      WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c WHERE x < 50000)
      SELECT
        (SELECT synchronous FROM pragma_synchronous) AS synchronous,
        (SELECT foreign_keys FROM pragma_foreign_keys) AS foreignKeys,
        (SELECT timeout FROM pragma_busy_timeout) AS busyTimeout,
        count(*) AS n
      FROM c`;

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        prisma.$queryRawUnsafe<
          { synchronous: bigint; foreignKeys: bigint; busyTimeout: bigint }[]
        >(slowPragmaProbe),
      ),
    );

    for (const [row] of results) {
      expect(Number(row.synchronous)).toBe(1);
      expect(Number(row.foreignKeys)).toBe(1);
      expect(Number(row.busyTimeout)).toBe(5000);
    }
  });
});

describe("applySqlitePragmas", () => {
  it("ghi logger.warn va khong nem loi khi pragma that bai", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const client = {
      $queryRawUnsafe: vi.fn().mockRejectedValue(new Error("disk I/O error")),
    };

    await expect(
      applySqlitePragmas(client, "file:./dev.db"),
    ).resolves.toBeUndefined();

    expect(client.$queryRawUnsafe).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalled();
  });

  it("bo qua khi DATABASE_URL khong phai SQLite file", async () => {
    const client = { $queryRawUnsafe: vi.fn().mockResolvedValue([]) };

    await applySqlitePragmas(client, "postgresql://localhost/db");

    expect(client.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("chay dung thu tu cac pragma", async () => {
    const client = { $queryRawUnsafe: vi.fn().mockResolvedValue([]) };

    await applySqlitePragmas(client, "file:./dev.db");

    expect(client.$queryRawUnsafe.mock.calls.map(([sql]) => sql)).toEqual([
      "PRAGMA journal_mode=WAL;",
      "PRAGMA busy_timeout=5000;",
      "PRAGMA synchronous=NORMAL;",
      "PRAGMA foreign_keys=ON;",
    ]);
  });
});

describe("withSqliteConnectionLimit", () => {
  it("them connection_limit=1 cho URL SQLite file", () => {
    expect(withSqliteConnectionLimit("file:./dev.db")).toBe(
      "file:./dev.db?connection_limit=1",
    );
    expect(withSqliteConnectionLimit("file:./dev.db?socket_timeout=10")).toBe(
      "file:./dev.db?socket_timeout=10&connection_limit=1",
    );
  });

  it("giu nguyen URL da co connection_limit hoac khong phai SQLite", () => {
    expect(withSqliteConnectionLimit("file:./dev.db?connection_limit=4")).toBe(
      "file:./dev.db?connection_limit=4",
    );
    expect(withSqliteConnectionLimit("postgresql://localhost/db")).toBe(
      "postgresql://localhost/db",
    );
    expect(withSqliteConnectionLimit(undefined)).toBeUndefined();
  });
});

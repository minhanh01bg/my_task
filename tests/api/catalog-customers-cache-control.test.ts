import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/require-admin-session", () => ({
  hasAdminSession: vi.fn(),
}));
vi.mock("@/server/catalog/get-pos-catalog", () => ({
  getPosCatalog: vi.fn(),
}));
vi.mock("@/server/db/prisma", () => ({
  prisma: { customer: { findMany: vi.fn(), create: vi.fn() } },
}));

import { GET as getCatalog } from "@/app/api/catalog/route";
import {
  GET as listCustomers,
  POST as createCustomer,
} from "@/app/api/customers/route";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getPosCatalog } from "@/server/catalog/get-pos-catalog";
import { prisma } from "@/server/db/prisma";

const ORIGIN = "http://localhost";

const mockedSession = vi.mocked(hasAdminSession);
const mockedCatalog = vi.mocked(getPosCatalog);
const mockedFindMany = vi.mocked(prisma.customer.findMany);
const mockedCreate = vi.mocked(prisma.customer.create);

function catalogRequest() {
  return getCatalog(new Request(`${ORIGIN}/api/catalog`));
}

function listRequest(query = "") {
  return listCustomers(new Request(`${ORIGIN}/api/customers${query}`));
}

function createRequest(body: string, origin = ORIGIN) {
  return createCustomer(
    new Request(`${ORIGIN}/api/customers`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body,
    }),
  );
}

const CASES: Array<[string, number, () => Promise<Response>]> = [
  ["GET /api/catalog chưa đăng nhập", 401, catalogRequest],
  ["GET /api/catalog thành công", 200, catalogRequest],
  ["GET /api/customers chưa đăng nhập", 401, () => listRequest()],
  [
    "GET /api/customers từ khoá quá dài",
    400,
    () => listRequest(`?q=${"a".repeat(101)}`),
  ],
  ["GET /api/customers thành công", 200, () => listRequest("?q=An")],
  ["POST /api/customers chưa đăng nhập", 401, () => createRequest("{}")],
  [
    "POST /api/customers sai nguồn gốc",
    403,
    () => createRequest('{"name":"An"}', "https://evil.example"),
  ],
  ["POST /api/customers JSON hỏng", 400, () => createRequest("{")],
  [
    "POST /api/customers body quá lớn",
    413,
    () => createRequest(JSON.stringify({ name: "a".repeat(5_000) })),
  ],
  ["POST /api/customers thiếu tên", 400, () => createRequest("{}")],
  ["POST /api/customers thành công", 201, () => createRequest('{"name":"An"}')],
];

describe("Cache-Control của API catalog/customers (WB-6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSession.mockResolvedValue(true);
    mockedCatalog.mockResolvedValue({ products: [] } as never);
    mockedFindMany.mockResolvedValue([] as never);
    mockedCreate.mockResolvedValue({
      id: "c1",
      name: "An",
      phone: null,
    } as never);
  });

  it.each(CASES)("%s trả private, no-store", async (name, status, send) => {
    if (name.includes("chưa đăng nhập")) mockedSession.mockResolvedValue(false);

    const response = await send();

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each([
    [
      "GET /api/catalog",
      () => mockedCatalog.mockRejectedValue(new Error("db down")),
      catalogRequest,
    ],
    [
      "GET /api/customers",
      () => mockedFindMany.mockRejectedValue(new Error("db down")),
      () => listRequest(),
    ],
    [
      "POST /api/customers",
      () => mockedCreate.mockRejectedValue(new Error("db down")),
      () => createRequest('{"name":"An"}'),
    ],
    [
      "phiên quản trị lỗi",
      () => mockedSession.mockRejectedValue(new Error("db down")),
      catalogRequest,
    ],
  ] as const)(
    "%s lỗi bất ngờ vẫn trả private, no-store và mã tương quan",
    async (_name, fail, send) => {
      fail();

      const response = await send();

      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      const body = await response.json();
      expect(body.correlationId).toEqual(expect.any(String));
      expect(JSON.stringify(body)).not.toContain("db down");
    },
  );
});

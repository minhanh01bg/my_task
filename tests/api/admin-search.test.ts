import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/require-admin-session", () => ({
  hasAdminSession: vi.fn(),
}));
vi.mock("@/server/admin/search", () => ({
  ADMIN_SEARCH_MAX_QUERY_LENGTH: 100,
  searchAdmin: vi.fn(),
}));

import { GET } from "@/app/api/admin/search/route";
import { isPublicPath } from "@/lib/auth/public-paths";
import { searchAdmin } from "@/server/admin/search";
import { hasAdminSession } from "@/server/auth/require-admin-session";

const mockedAuth = vi.mocked(hasAdminSession);
const mockedSearch = vi.mocked(searchAdmin);

const results = {
  products: Array.from({ length: 5 }, (_, i) => ({
    id: `p${i}`,
    name: `Sản phẩm ${i}`,
    sku: null,
    href: `/admin/products?q=S%E1%BA%A3n&edit=p${i}`,
  })),
  orders: [
    {
      id: "o1",
      code: "DH1001",
      customerName: "Chú Tư",
      total: 50_000,
      href: "/admin/orders/o1",
    },
  ],
  customers: [
    {
      id: "c1",
      displayName: "Khách A",
      phone: "0901234567",
      href: "/admin/orders?q=0901234567",
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("GET /api/admin/search", () => {
  it("không phải đường public — proxy luôn chặn khi thiếu cookie", () => {
    expect(isPublicPath("/api/admin/search")).toBe(false);
  });

  it("401 khi chưa đăng nhập admin, không truy vấn", async () => {
    mockedAuth.mockResolvedValue(false);
    const response = await GET(
      new Request("http://localhost/api/admin/search?q=oc", {
        headers: { cookie: "customer_session=customer-only" },
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("400 khi tham số không hợp lệ", async () => {
    mockedAuth.mockResolvedValue(true);
    const tooLong = await GET(
      new Request(`http://localhost/api/admin/search?q=${"a".repeat(101)}`),
    );
    expect(tooLong.status).toBe(400);
    const extra = await GET(
      new Request("http://localhost/api/admin/search?q=oc&x=1"),
    );
    expect(extra.status).toBe(400);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("trả kết quả nhóm, tối đa 5 mỗi nhóm, không có passwordHash", async () => {
    mockedAuth.mockResolvedValue(true);
    mockedSearch.mockResolvedValue(results);
    const response = await GET(
      new Request("http://localhost/api/admin/search?q=%20%C3%B3c%20"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mockedSearch).toHaveBeenCalledWith("óc");
    const body = (await response.json()) as { data: typeof results };
    expect(body.data).toEqual(results);
    for (const group of Object.values(body.data)) {
      expect(group.length).toBeLessThanOrEqual(5);
    }
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("401 khi không có cookie, dùng hasAdminSession thật (không mock)", async () => {
    vi.resetModules();
    vi.doUnmock("@/server/auth/require-admin-session");
    try {
      const { GET: GetUnmocked } = await import("@/app/api/admin/search/route");
      const response = await GetUnmocked(
        new Request("http://localhost/api/admin/search?q=oc"),
      );
      expect(response.status).toBe(401);
    } finally {
      vi.doMock("@/server/auth/require-admin-session", () => ({
        hasAdminSession: vi.fn(),
      }));
    }
  });

  it("thiếu q trả nhóm rỗng", async () => {
    mockedAuth.mockResolvedValue(true);
    mockedSearch.mockResolvedValue({ products: [], orders: [], customers: [] });
    const response = await GET(
      new Request("http://localhost/api/admin/search"),
    );
    expect(response.status).toBe(200);
    expect(mockedSearch).toHaveBeenCalledWith("");
  });
});

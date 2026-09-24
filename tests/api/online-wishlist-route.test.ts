import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/online/wishlist/route";
import { getWishlistProducts } from "@/server/storefront/wishlist-products";

vi.mock("@/server/storefront/wishlist-products", () => ({
  getWishlistProducts: vi.fn(),
}));

describe("GET /api/online/wishlist", () => {
  it("trả sản phẩm theo ids", async () => {
    vi.mocked(getWishlistProducts).mockResolvedValue([]);
    const response = await GET(
      new Request("https://example.com/api/online/wishlist?ids=a,b"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { products: [] } });
    expect(getWishlistProducts).toHaveBeenCalledWith(["a", "b"]);
  });

  it("từ chối quá nhiều id", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `p${i}`).join(",");
    const response = await GET(
      new Request(`https://example.com/api/online/wishlist?ids=${ids}`),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/tối đa/);
  });
});

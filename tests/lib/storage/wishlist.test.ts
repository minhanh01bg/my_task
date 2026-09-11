import { beforeEach, describe, expect, it } from "vitest";

import {
  clearWishlist,
  getWishlist,
  isWishlisted,
  toggleWishlist,
} from "@/lib/storage/wishlist";

describe("Wishlist storage manager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mặc định danh sách yêu thích rỗng", () => {
    expect(getWishlist()).toEqual([]);
    expect(isWishlisted("prod-1")).toBe(false);
  });

  it("thêm và xóa sản phẩm khỏi danh sách yêu thích", () => {
    // 1. Thêm vào yêu thích
    const added = toggleWishlist("prod-1");
    expect(added).toBe(true);
    expect(isWishlisted("prod-1")).toBe(true);
    expect(getWishlist()).toEqual(["prod-1"]);

    // 2. Bỏ khỏi yêu thích
    const removed = toggleWishlist("prod-1");
    expect(removed).toBe(false);
    expect(isWishlisted("prod-1")).toBe(false);
    expect(getWishlist()).toEqual([]);
  });

  it("cho phép xóa sạch toàn bộ danh sách yêu thích", () => {
    toggleWishlist("p1");
    toggleWishlist("p2");
    expect(getWishlist()).toHaveLength(2);

    clearWishlist();
    expect(getWishlist()).toEqual([]);
  });
});

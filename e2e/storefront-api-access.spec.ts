import { expect, test } from "@playwright/test";

test("API cửa hàng không yêu cầu phiên quản trị, gửi đánh giá vẫn cần phiên khách", async ({
  request,
}) => {
  const wishlist = await request.get("/api/online/wishlist");
  expect(wishlist.status()).toBe(200);
  expect(await wishlist.json()).toEqual({ data: { products: [] } });

  const voucher = await request.post("/api/online/vouchers/validate", {
    data: { code: "E2E-NOT-A-VOUCHER", subtotal: 100_000 },
  });
  expect(voucher.status()).toBe(200);
  expect((await voucher.json()).data.ok).toBe(false);

  const reviews = await request.get("/api/online/products/missing/reviews");
  expect(reviews.status()).toBe(200);
  expect((await reviews.json()).items).toEqual([]);

  const createReview = await request.post(
    "/api/online/products/missing/reviews",
    { data: { rating: 5, content: "Sản phẩm tốt" } },
  );
  expect(createReview.status()).toBe(401);
  expect((await createReview.json()).message).toBe(
    "Vui lòng đăng nhập để gửi đánh giá",
  );

  const adminSearch = await request.get("/api/admin/search?q=test");
  expect(adminSearch.status()).toBe(401);
});

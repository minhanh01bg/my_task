import { describe, expect, it } from "vitest";

import {
  isAllowedProductImageUrl,
  sanitizeProductImageUrl,
} from "@/lib/product-image-url";

// WB-7: next/image chỉ cho images.unsplash.com, còn POS tải thẳng URL ảnh —
// host lạ vừa vỡ ảnh ở shop vừa lộ IP/User-Agent của máy POS.
const ALLOWED = [
  "/products/mi-hao-hao.webp",
  "/uploads/0123abcd.webp",
  "/uploads/products/test-image-123.webp",
  "https://images.unsplash.com/photo-1542838132-92c53300491e",
  "https://images.unsplash.com/photo-1?w=400&q=80",
];

const REJECTED = [
  "",
  "https://example.com/a.jpg",
  "https://cdn.example.com/a.webp",
  "http://images.unsplash.com/x",
  "https://images.unsplash.com",
  "https://images.unsplash.com.evil.com/x",
  "https://evil.com/images.unsplash.com/x",
  "https://user:pass@images.unsplash.com/x",
  "https://images.unsplash.com:8443/x",
  "https://images.unsplash.com\\@evil.com/x",
  "https:images.unsplash.com/x",
  "//images.unsplash.com/x",
  " https://images.unsplash.com/x",
  "https://images.unsplash.com/x y",
  `https://images.unsplash.com/${"a".repeat(2100)}`,
  "/products/../secret.webp",
  "/products/sub/secret.webp",
  "/other/image.webp",
  "javascript:alert(1)",
  "data:image/png;base64,AAAA",
];

describe("isAllowedProductImageUrl", () => {
  it.each(ALLOWED)("cho phép %s", (url) => {
    expect(isAllowedProductImageUrl(url)).toBe(true);
  });

  it.each(REJECTED)("từ chối %s", (url) => {
    expect(isAllowedProductImageUrl(url)).toBe(false);
  });
});

describe("sanitizeProductImageUrl", () => {
  it("giữ nguyên ảnh hợp lệ", () => {
    for (const url of ALLOWED) expect(sanitizeProductImageUrl(url)).toBe(url);
  });

  it("đổi ảnh cũ không hợp lệ (http, host lạ) thành null", () => {
    expect(sanitizeProductImageUrl("http://example.com/a.jpg")).toBeNull();
    expect(sanitizeProductImageUrl("https://example.com/a.jpg")).toBeNull();
    expect(sanitizeProductImageUrl("")).toBeNull();
    expect(sanitizeProductImageUrl(null)).toBeNull();
    expect(sanitizeProductImageUrl(undefined)).toBeNull();
  });
});

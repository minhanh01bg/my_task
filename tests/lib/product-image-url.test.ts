import { hasRemoteMatch } from "next/dist/shared/lib/match-remote-pattern";
import { describe, expect, it } from "vitest";

import {
  isAllowedProductImageUrl,
  sanitizeProductImageUrl,
} from "@/lib/product-image-url";

import nextConfig from "../../next.config";

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
  "http://images.unsplash.com/photo-1",
  "https://images.unsplash.com",
  "https://images.unsplash.com.evil.com/photo-1",
  "https://evil.com/images.unsplash.com/photo-1",
  "https://user:pass@images.unsplash.com/photo-1",
  "https://images.unsplash.com:8443/photo-1",
  "https://images.unsplash.com\\@evil.com/photo-1",
  "https:images.unsplash.com/photo-1",
  "//images.unsplash.com/photo-1",
  " https://images.unsplash.com/photo-1",
  "https://images.unsplash.com/photo-1 y",
  `https://images.unsplash.com/photo-${"a".repeat(2100)}`,
  // next.config chỉ tối ưu /photo-* (một đoạn đường dẫn): còn lại /_next/image trả 400.
  "https://images.unsplash.com/flagged/photo-1556745753-b2904692b3cd",
  "https://images.unsplash.com/premium_photo-1661301073967-7a4a4d4e5a0b",
  "https://images.unsplash.com/profile-1446404465118-3a53b909cc82",
  "https://images.unsplash.com/photo-1/x",
  "https://images.unsplash.com/photo-1\\x",
  "https://images.unsplash.com/photo-1#x",
  "https://images.unsplash.com/photo-",
  "https://images.unsplash.com/x",
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

describe("isAllowedProductImageUrl khớp images.remotePatterns của next.config", () => {
  // Lưu được ảnh mà /_next/image từ chối thì mọi trang shop hiện ảnh vỡ.
  const nextAllows = (url: string) =>
    hasRemoteMatch([], nextConfig.images?.remotePatterns ?? [], new URL(url));

  it.each([
    "https://images.unsplash.com/photo-1542838132-92c53300491e",
    "https://images.unsplash.com/photo-1?w=400&q=80",
    "https://images.unsplash.com/photo-1?next=/a/b",
    "https://images.unsplash.com/photo-1%2Fx",
    "https://images.unsplash.com/flagged/photo-1556745753-b2904692b3cd",
    "https://images.unsplash.com/premium_photo-1661301073967-7a4a4d4e5a0b",
    "https://images.unsplash.com/profile-1446404465118-3a53b909cc82",
    "https://images.unsplash.com/photo-1/x",
    "https://images.unsplash.com/photo-1\\x",
    "https://images.unsplash.com/a/photo-1",
    "https://images.unsplash.com/x",
    "https://images.unsplash.com/",
  ])("%s", (url) => {
    expect(isAllowedProductImageUrl(url)).toBe(nextAllows(url));
  });

  it("mọi ảnh ngoài được phép đều qua được next/image", () => {
    const remote = ALLOWED.filter((url) => url.startsWith("https://"));
    expect(remote.length).toBeGreaterThan(0);
    for (const url of remote) expect(nextAllows(url)).toBe(true);
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

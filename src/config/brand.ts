/**
 * Màu thương hiệu dạng hex cho nơi không đọc được CSS variable (ảnh OG qua
 * Satori, manifest PWA). Quy đổi từ token light trong globals.css:
 * `--primary` oklch(0.38 0.075 153), `--primary-foreground`
 * oklch(0.985 0.005 82), `--accent` oklch(0.72 0.115 73). Đổi token thì đổi ở đây.
 */
export const BRAND_COLORS = {
  primary: "#1d4e2f",
  primaryForeground: "#fcfaf6",
  accent: "#d0994c",
} as const;

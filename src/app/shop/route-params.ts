import { notFound } from "next/navigation";

import { SLUG_MAX_LENGTH } from "@/lib/seo/slugify";

/*
 * Trang ISR /shop render và cache kết quả cho mọi giá trị param. Giá trị không
 * thể là slug/id thật thì 404 ngay, trước khi truy vấn DB.
 */

/** Đúng dạng `slugify` sinh ra: a-z0-9, nối bằng một dấu `-`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** cuid trong production; seed/test có id tự đặt như `test-route-slug-01`. */
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function shopSlug(value: string): string {
  if (value.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(value)) notFound();
  return value;
}

export function shopProductId(value: string): string {
  if (!PRODUCT_ID_PATTERN.test(value)) notFound();
  return value;
}

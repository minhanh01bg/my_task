/**
 * Which product image URLs may be stored and served. Shop pages render them
 * through next/image, which only allows images.unsplash.com (next.config),
 * while POS loads the URL directly, so any other host both breaks the shop
 * image and leaks every POS terminal's IP/User-Agent to that host.
 * Isomorphic: used by the admin action and by the catalog read mappers.
 */

const MAX_PRODUCT_IMAGE_URL_LENGTH = 2048;

/** /products/<file> (sample images) and /uploads/[products/]<file> (uploads). */
const LOCAL_IMAGE_PATH =
  /^\/(?:products\/|uploads\/(?:products\/)?)[a-zA-Z0-9][a-zA-Z0-9.-]*$/;

/**
 * Exact https origin plus a path: no credentials, port, look-alike host,
 * whitespace or backslash for the URL parser to "repair".
 */
const UNSPLASH_IMAGE_URL = /^https:\/\/images\.unsplash\.com\/[^\s\\]*$/;

export function isAllowedProductImageUrl(url: string): boolean {
  if (url.length > MAX_PRODUCT_IMAGE_URL_LENGTH) return false;
  return LOCAL_IMAGE_PATH.test(url) || UNSPLASH_IMAGE_URL.test(url);
}

/** Legacy rows may hold http:// or other-host URLs: serve those as no image. */
export function sanitizeProductImageUrl(
  url: string | null | undefined,
): string | null {
  return url && isAllowedProductImageUrl(url) ? url : null;
}

/** Copy of a product row with its image sanitized, for catalog read mappers. */
export function withSafeProductImage<T extends { imageUrl: string | null }>(
  product: T,
): T {
  return { ...product, imageUrl: sanitizeProductImageUrl(product.imageUrl) };
}

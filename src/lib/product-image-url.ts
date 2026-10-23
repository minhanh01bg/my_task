/**
 * Which product and storefront promotion image URLs may be stored and served.
 * Shop pages render them through next/image, which only allows
 * images.unsplash.com (next.config), while POS loads the URL directly, so any
 * other host both breaks the shop image and leaks every POS terminal's (or,
 * for promotion banners, every shop visitor's) IP/User-Agent to that host.
 * Isomorphic: used by the admin actions and forms (products, promotions), the
 * promotion schemas in types/storefront and the catalog/promotion read mappers.
 */

const MAX_PRODUCT_IMAGE_URL_LENGTH = 2048;

/** /products/<file> (sample images) and /uploads/[products/]<file> (uploads). */
const LOCAL_IMAGE_PATH =
  /^\/(?:products\/|uploads\/(?:products\/)?)[a-zA-Z0-9][a-zA-Z0-9.-]*$/;

/**
 * Same rule as next.config images.remotePatterns (`/photo-*`, where `*` is one
 * path segment), or /_next/image answers 400 and every shop page shows a
 * broken image: exact https origin, then a single `photo-<id>` segment and an
 * optional query. No credentials, port, look-alike host, further segment,
 * fragment, whitespace or backslash for the URL parser to "repair".
 */
const UNSPLASH_IMAGE_URL =
  /^https:\/\/images\.unsplash\.com\/photo-[^\s\\/?#]+(?:\?[^\s\\#]*)?$/;

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

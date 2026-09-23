export const FALLBACK_STORE_NAME = "Cửa hàng";

type StoreNameEnv = {
  NEXT_PUBLIC_STORE_NAME?: string;
  STORE_NAME?: string;
};

/**
 * Tên cửa hàng mặc định khi DB chưa khai báo `store.name`:
 * NEXT_PUBLIC_STORE_NAME → STORE_NAME → "Cửa hàng". Dùng chung cho
 * `siteConfig.name` và `getPublicStoreProfile()` để hai nơi luôn khớp.
 * Không import `env` để server settings/script dùng được với `process.env`.
 */
export function resolveDefaultStoreName(source: StoreNameEnv): string {
  return (
    source.NEXT_PUBLIC_STORE_NAME?.trim() ||
    source.STORE_NAME?.trim() ||
    FALLBACK_STORE_NAME
  );
}

/**
 * Tag cache cho du lieu cong khai (unstable_cache). Moi duong ghi lam thay doi
 * du lieu tuong ung PHAI goi `revalidatePublic(...)` sau khi ghi thanh cong.
 */
export const CACHE_TAGS = {
  catalog: "catalog",
  settings: "settings",
  promotions: "promotions",
  vouchers: "vouchers",
  product: (id: string) => `product:${id}`,
} as const;

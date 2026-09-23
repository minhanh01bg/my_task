import { revalidateTag, unstable_cache, updateTag } from "next/cache";

import { logger } from "@/lib/logger";

export interface CachedPublicOptions {
  tags: string[];
  /** Giay. */
  revalidate: number;
}

/**
 * Vitest khong co request store cua Next — unstable_cache/revalidateTag se
 * nem "Invariant ... missing". Trong test ta doc/ghi thang DB.
 */
function isTestRuntime(): boolean {
  return Boolean(process.env.VITEST);
}

let warnedMissingStore = false;

/**
 * Doc du lieu cong khai qua Data Cache cua Next theo tag. Ket qua phai
 * serialize duoc bang JSON (khong Date/Map). `keyParts` phai duy nhat cho
 * moi loader vi wrapper ben trong giong nhau giua cac loader.
 *
 * Ngoai request (script, test) unstable_cache khong co store: goi thang `fn`.
 */
export async function cachedPublic<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  options: CachedPublicOptions,
): Promise<T> {
  if (isTestRuntime()) return fn();

  let invoked = false;
  const tracked = () => {
    invoked = true;
    return fn();
  };

  try {
    return await unstable_cache(tracked, keyParts, {
      tags: options.tags,
      revalidate: options.revalidate,
    })();
  } catch (error: unknown) {
    // Loi tu chinh fn (vd. DB) thi nem lai — khong chay truy van lan hai.
    if (invoked) throw error;

    if (!warnedMissingStore) {
      warnedMissingStore = true;
      logger.warn("unstable_cache không khả dụng, đọc trực tiếp DB", {
        keyParts,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return fn();
  }
}

function runForEachTag(
  tags: string[],
  label: string,
  invalidate: (tag: string) => void,
): void {
  if (isTestRuntime()) return;

  for (const tag of tags) {
    try {
      invalidate(tag);
    } catch (error: unknown) {
      logger.warn(`${label} thất bại`, {
        tag,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Danh dau stale (stale-while-revalidate) cac tag cong khai. Goi SAU khi ghi
 * thanh cong — voi transaction thi goi sau khi `$transaction` tra ve, khong
 * bao gio ben trong. Khong bao gio nem.
 */
export function revalidatePublic(...tags: string[]): void {
  runForEachTag(tags, "revalidateTag", (tag) => revalidateTag(tag, "max"));
}

/**
 * Chi dung trong Server Action khi trang admin doc lai chinh du lieu vua ghi
 * qua loader co cache: het han ngay de khong hien gia tri cu (read-your-own-writes).
 * Khong bao gio nem.
 */
export function expirePublicNow(...tags: string[]): void {
  runForEachTag(tags, "updateTag", (tag) => updateTag(tag));
}

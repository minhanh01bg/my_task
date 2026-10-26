import {
  revalidatePath,
  revalidateTag,
  unstable_cache,
  updateTag,
} from "next/cache";

import { errorLogFields, logger } from "@/lib/logger";

export interface CachedPublicOptions<T> {
  tags: string[];
  /** Giay. */
  revalidate: number;
  /**
   * Chi dung luc `next build` (prerender): loader loi (vd. DB chua co bang)
   * thi tra gia tri nay thay vi lam hong build. Luc chay that loi van nem.
   */
  fallback?: () => T;
}

/**
 * Vitest khong co request store cua Next — unstable_cache/revalidateTag se
 * nem "Invariant ... missing". Trong test ta doc/ghi thang DB.
 */
function isTestRuntime(): boolean {
  return Boolean(process.env.VITEST);
}

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

let warnedMissingStore = false;
const warnedBuildFallbackKeys = new Set<string>();

/**
 * Doc du lieu cong khai qua Data Cache cua Next theo tag. Ket qua phai
 * serialize duoc bang JSON (khong Date/Map). `keyParts` phai duy nhat cho
 * moi loader vi wrapper ben trong giong nhau giua cac loader.
 *
 * Ngoai request (script, test) unstable_cache khong co store: goi thang `fn`.
 * Co `fallback` va dang `next build` thi loi loader tra fallback (xem
 * `CachedPublicOptions.fallback`).
 */
export async function cachedPublic<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  options: CachedPublicOptions<T>,
): Promise<T> {
  try {
    return await readThroughCache(fn, keyParts, options);
  } catch (error: unknown) {
    const { fallback } = options;
    if (!fallback || !isBuildPhase()) throw error;

    const key = keyParts.join("\u0000");
    if (!warnedBuildFallbackKeys.has(key)) {
      warnedBuildFallbackKeys.add(key);
      logger.warn(
        "Không đọc được dữ liệu công khai lúc build, dùng giá trị rỗng",
        {
          keyParts,
          ...errorLogFields(error),
        },
      );
    }
    return fallback();
  }
}

async function readThroughCache<T>(
  fn: () => Promise<T>,
  keyParts: string[],
  options: CachedPublicOptions<T>,
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
        ...errorLogFields(error),
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
        ...errorLogFields(error),
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

/**
 * Het han ngay trang cong khai theo duong dan that (vd. `/shop/p/<slug>`):
 * `revalidatePath(path)` bo ca entry ISR cua trang lan du lieu `unstable_cache`
 * doc trong trang, lan tai sau doc lai DB (khong nhan ban cu). Dung khi khach
 * sap mo dung trang do (vd. bam thong bao co hang). Khong het han theo tag vi
 * moi `revalidatePublic` ("max") sau do day han het cua tag lui mot nam; tag
 * duong dan thi khong ai danh dau stale lai. Chay trong Server Action va Route
 * Handler; job nen (setInterval) khong co store cua Next nen lenh nem — chi
 * ghi log. Goi SAU commit. Khong bao gio nem.
 */
export function expirePublicPathsNow(...paths: string[]): void {
  if (isTestRuntime()) return;

  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch (error: unknown) {
      logger.warn("revalidatePath thất bại", {
        path,
        ...errorLogFields(error),
      });
    }
  }
}

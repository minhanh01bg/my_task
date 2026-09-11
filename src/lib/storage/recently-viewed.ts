export interface RecentlyViewedItem {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string | null;
  categoryId?: string | null;
  viewedAt?: number;
}

const STORAGE_KEY = "pos_store_recently_viewed";
const MAX_RECENT_ITEMS = 8;

export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function recordRecentlyViewed(
  item: Omit<RecentlyViewedItem, "viewedAt">,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = getRecentlyViewed();
    const filtered = current.filter((i) => i.id !== item.id);
    const updated: RecentlyViewedItem[] = [
      { ...item, viewedAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_RECENT_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event("recently_viewed_updated"));
  } catch {
    // ignore local storage errors
  }
}

export function clearRecentlyViewed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("recently_viewed_updated"));
  } catch {
    // ignore
  }
}

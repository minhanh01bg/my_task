import type { CatalogResponse } from "@/types/catalog";

import { getSyncDb } from "./queue";

const CATALOG_STORE = "catalog";
const CATALOG_KEY = "current";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Luu danh muc de mat mang van tim va ban duoc. */
export async function saveCatalog(catalog: CatalogResponse): Promise<void> {
  const db = await getSyncDb();
  await db.put(CATALOG_STORE, catalog, CATALOG_KEY);
}

export async function loadCatalog(): Promise<CatalogResponse | null> {
  const db = await getSyncDb();
  const cached = (await db.get(CATALOG_STORE, CATALOG_KEY)) as
    | CatalogResponse
    | undefined;
  return cached ?? null;
}

/**
 * Danh muc cu hon 24 gio thi nhac lam moi — nhung VAN CHO BAN.
 * Chan ban vi danh muc cu la vi pham nguyen tac "khong chan viec ban".
 */
export function isCatalogStale(catalog: CatalogResponse): boolean {
  const fetchedAt = new Date(catalog.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) return true;
  return Date.now() - fetchedAt > STALE_AFTER_MS;
}

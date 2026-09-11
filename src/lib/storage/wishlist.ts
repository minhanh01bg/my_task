"use client";

import { useSyncExternalStore } from "react";

const WISHLIST_STORAGE_KEY = "online-wishlist-v1";
const WISHLIST_EVENT = "online-wishlist-updated";

let memoryWishlist: string[] = [];

function readStorage(): string[] {
  if (typeof window === "undefined") return memoryWishlist;
  try {
    const raw = localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: string[]): void {
  memoryWishlist = items;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent(WISHLIST_EVENT));
    } catch {
      // ignore storage quota errors
    }
  }
}

export function getWishlist(): string[] {
  return readStorage();
}

export function isWishlisted(productId: string): boolean {
  const list = readStorage();
  return list.includes(productId);
}

export function toggleWishlist(productId: string): boolean {
  const current = readStorage();
  const exists = current.includes(productId);
  let updated: string[];

  if (exists) {
    updated = current.filter((id) => id !== productId);
  } else {
    updated = [productId, ...current];
  }

  writeStorage(updated);
  return !exists;
}

export function clearWishlist(): void {
  writeStorage([]);
}

function subscribeWishlist(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(WISHLIST_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(WISHLIST_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

let cachedSnapshot: string[] = [];
let cachedRaw = "";

function getWishlistSnapshot(): string[] {
  if (typeof window === "undefined") return memoryWishlist;
  const raw = localStorage.getItem(WISHLIST_STORAGE_KEY) || "[]";
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedSnapshot = JSON.parse(raw);
    } catch {
      cachedSnapshot = [];
    }
  }
  return cachedSnapshot;
}

const SERVER_SNAPSHOT: string[] = [];

export function useWishlist() {
  const items = useSyncExternalStore(
    subscribeWishlist,
    getWishlistSnapshot,
    () => SERVER_SNAPSHOT,
  );

  return {
    items,
    count: items.length,
    has: (id: string) => items.includes(id),
    toggle: (id: string) => toggleWishlist(id),
    clear: () => clearWishlist(),
  };
}

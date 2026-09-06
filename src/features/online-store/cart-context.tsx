"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { OnlineCartLine, OnlineProduct } from "./types";

const STORAGE_KEY = "online-cart-v1";

interface CartContextValue {
  lines: OnlineCartLine[];
  hydrated: boolean;
  add: (product: OnlineProduct) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function OnlineCartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lines, setLines] = useState<OnlineCartLine[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as OnlineCartLine[]) : [];
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  });
  const hydrated = typeof window !== "undefined";

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [hydrated, lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      hydrated,
      add(product) {
        setLines((current) => {
          const found = current.find((line) => line.id === product.id);
          if (found)
            return current.map((line) =>
              line.id === product.id
                ? { ...line, quantity: Math.min(line.stock, line.quantity + 1) }
                : line,
            );
          return [...current, { ...product, quantity: 1 }];
        });
      },
      setQuantity(id, quantity) {
        setLines((current) =>
          current.map((line) =>
            line.id === id
              ? {
                  ...line,
                  quantity: Math.max(0.01, Math.min(line.stock, quantity)),
                }
              : line,
          ),
        );
      },
      remove(id) {
        setLines((current) => current.filter((line) => line.id !== id));
      },
      clear() {
        setLines([]);
      },
    }),
    [hydrated, lines],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useOnlineCart() {
  const context = useContext(CartContext);
  if (!context)
    throw new Error("useOnlineCart must be used inside OnlineCartProvider");
  return context;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  CartMutationResult,
  OnlineCartLine,
  OnlineProduct,
} from "./types";

const STORAGE_KEY = "online-cart-v1";

interface CartContextValue {
  lines: OnlineCartLine[];
  hydrated: boolean;
  feedback: CartMutationResult | null;
  dismissFeedback: () => void;
  add: (product: OnlineProduct) => CartMutationResult;
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
  const [feedback, setFeedback] = useState<CartMutationResult | null>(null);
  const hydrated = typeof window !== "undefined";

  const linesRef = useRef(lines);

  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [hydrated, lines]);

  const dismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const add = useCallback((product: OnlineProduct): CartMutationResult => {
    if (product.stock <= 0) {
      const result: CartMutationResult = {
        status: "unavailable",
        productId: product.id,
        productName: product.name,
        quantity: 0,
        message: "Sản phẩm hiện đã hết hàng hoặc không khả dụng",
      };
      setFeedback(result);
      return result;
    }

    const currentLines = linesRef.current;
    const found = currentLines.find((line) => line.id === product.id);

    if (found) {
      if (found.quantity >= product.stock) {
        const result: CartMutationResult = {
          status: "capped",
          productId: product.id,
          productName: product.name,
          quantity: found.quantity,
          maxAvailable: product.stock,
          message: "Đã đạt số lượng tối đa trong kho",
        };
        setFeedback(result);
        return result;
      }

      const nextQuantity = found.quantity + 1;
      setLines((current) =>
        current.map((line) =>
          line.id === product.id ? { ...line, quantity: nextQuantity } : line,
        ),
      );
      const result: CartMutationResult = {
        status: "incremented",
        productId: product.id,
        productName: product.name,
        quantity: nextQuantity,
      };
      setFeedback(result);
      return result;
    }

    setLines((current) => [...current, { ...product, quantity: 1 }]);
    const result: CartMutationResult = {
      status: "added",
      productId: product.id,
      productName: product.name,
      quantity: 1,
    };
    setFeedback(result);
    return result;
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
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
  }, []);

  const remove = useCallback((id: string) => {
    setLines((current) => current.filter((line) => line.id !== id));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      hydrated,
      feedback,
      dismissFeedback,
      add,
      setQuantity,
      remove,
      clear,
    }),
    [
      lines,
      hydrated,
      feedback,
      dismissFeedback,
      add,
      setQuantity,
      remove,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useOnlineCart() {
  const context = useContext(CartContext);
  if (!context)
    throw new Error("useOnlineCart must be used inside OnlineCartProvider");
  return context;
}

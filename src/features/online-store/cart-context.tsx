"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
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
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  add: (product: OnlineProduct, quantity?: number) => CartMutationResult;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  /**
   * Tra lai dong vua xoa (Hoàn tác) dung vi tri cu, khong phat phan hoi
   * "đã thêm". Dong da duoc them lai trong luc cho thi giu so luong lon hon.
   */
  restore: (line: OnlineCartLine, index: number) => void;
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
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [feedback, setFeedback] = useState<CartMutationResult | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const add = useCallback(
    (product: OnlineProduct, qtyToAdd: number = 1): CartMutationResult => {
      const qty = Math.max(1, qtyToAdd);
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

        const nextQuantity = Math.min(product.stock, found.quantity + qty);
        const isCapped =
          nextQuantity === product.stock &&
          found.quantity + qty > product.stock;
        setLines((current) =>
          current.map((line) =>
            line.id === product.id ? { ...line, quantity: nextQuantity } : line,
          ),
        );
        const result: CartMutationResult = {
          status: isCapped ? "capped" : "incremented",
          productId: product.id,
          productName: product.name,
          quantity: nextQuantity,
          ...(isCapped
            ? {
                maxAvailable: product.stock,
                message: "Đã đạt số lượng tối đa trong kho",
              }
            : {}),
        };
        setFeedback(result);
        return result;
      }

      const initialQty = Math.min(product.stock, qty);
      setLines((current) => [...current, { ...product, quantity: initialQty }]);
      const result: CartMutationResult = {
        status: "added",
        productId: product.id,
        productName: product.name,
        quantity: initialQty,
      };
      setFeedback(result);
      return result;
    },
    [],
  );

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

  const restore = useCallback((line: OnlineCartLine, index: number) => {
    setLines((current) => {
      const existing = current.find((item) => item.id === line.id);
      if (existing) {
        return current.map((item) =>
          item.id === line.id
            ? {
                ...item,
                quantity: Math.min(
                  item.stock,
                  Math.max(item.quantity, line.quantity),
                ),
              }
            : item,
        );
      }
      const at = Math.max(0, Math.min(index, current.length));
      return [...current.slice(0, at), line, ...current.slice(at)];
    });
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
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      add,
      setQuantity,
      remove,
      restore,
      clear,
    }),
    [
      lines,
      hydrated,
      feedback,
      dismissFeedback,
      isDrawerOpen,
      openDrawer,
      closeDrawer,
      add,
      setQuantity,
      remove,
      restore,
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

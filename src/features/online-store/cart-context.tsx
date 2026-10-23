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

import {
  MAX_ONLINE_LINE_QUANTITY,
  ONLINE_LINE_QUANTITY_MESSAGE,
} from "@/types/online-order";

import type {
  CartMutationResult,
  OnlineCartLine,
  OnlineProduct,
} from "./types";

const STORAGE_KEY = "online-cart-v1";

/**
 * Don online chi nhan so luong nguyen (`z.number().int()`) nhung ton kho co
 * the le (2.5 kg), nen so luong toi da la phan nguyen cua ton kho — va khong
 * qua tran moi dong ma server chap nhan.
 */
function maxWholeQuantity(stock: number) {
  return Number.isFinite(stock)
    ? Math.min(MAX_ONLINE_LINE_QUANTITY, Math.floor(stock))
    : 0;
}

function cappedMessage(stock: number) {
  return Math.floor(stock) > MAX_ONLINE_LINE_QUANTITY
    ? ONLINE_LINE_QUANTITY_MESSAGE
    : "Đã đạt số lượng tối đa trong kho";
}

function clampWholeQuantity(quantity: number, stock: number) {
  const whole = Number.isFinite(quantity) ? Math.floor(quantity) : 1;
  return Math.max(1, Math.min(maxWholeQuantity(stock), whole));
}

/** Gio luu tu ban cu co the co so luong le; dong khong mua duoc thi bo. */
function readSavedLines(): OnlineCartLine[] {
  const saved = localStorage.getItem(STORAGE_KEY);
  const parsed: unknown = saved ? JSON.parse(saved) : [];
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((line: OnlineCartLine | null) =>
    typeof line?.id === "string" && maxWholeQuantity(line.stock) >= 1
      ? [{ ...line, quantity: clampWholeQuantity(line.quantity, line.stock) }]
      : [],
  );
}

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
      return readSavedLines();
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
      const qty = Number.isFinite(qtyToAdd)
        ? Math.max(1, Math.floor(qtyToAdd))
        : 1;
      const maxQuantity = maxWholeQuantity(product.stock);
      if (maxQuantity < 1) {
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
        if (found.quantity >= maxQuantity) {
          const result: CartMutationResult = {
            status: "capped",
            productId: product.id,
            productName: product.name,
            quantity: found.quantity,
            maxAvailable: maxQuantity,
            message: cappedMessage(product.stock),
          };
          setFeedback(result);
          return result;
        }

        const nextQuantity = Math.min(maxQuantity, found.quantity + qty);
        const isCapped =
          nextQuantity === maxQuantity && found.quantity + qty > maxQuantity;
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
                maxAvailable: maxQuantity,
                message: cappedMessage(product.stock),
              }
            : {}),
        };
        setFeedback(result);
        return result;
      }

      const initialQty = Math.min(maxQuantity, qty);
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
          ? { ...line, quantity: clampWholeQuantity(quantity, line.stock) }
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
                quantity: clampWholeQuantity(
                  Math.max(item.quantity, line.quantity),
                  item.stock,
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

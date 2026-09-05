import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CartLine } from "@/lib/pricing/types";
import type { SearchableProduct } from "@/lib/search/types";

interface CartState {
  lines: CartLine[];
  orderDiscount: number;
  addProduct: (product: SearchableProduct) => void;
  addService: (name: string, amount: number) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateUnitPrice: (lineId: string, unitPrice: number) => void;
  updateDiscount: (lineId: string, discount: number) => void;
  removeLine: (lineId: string) => void;
  setOrderDiscount: (value: number) => void;
  clear: () => void;
}

function newLineId(): string {
  return crypto.randomUUID();
}

function patchLine(
  lines: CartLine[],
  lineId: string,
  patch: Partial<CartLine>,
): CartLine[] {
  return lines.map((line) =>
    line.id === lineId ? { ...line, ...patch } : line,
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      orderDiscount: 0,

      addProduct: (product) =>
        set((state) => {
          const existing = state.lines.find(
            (line) => line.productId === product.id && !line.isService,
          );

          if (existing) {
            return {
              lines: patchLine(state.lines, existing.id, {
                quantity: existing.quantity + 1,
              }),
            };
          }

          const line: CartLine = {
            id: newLineId(),
            productId: product.id,
            name: product.name,
            unitPrice: product.price,
            originalPrice: product.price,
            quantity: 1,
            discount: 0,
            unit: product.unit,
            isService: false,
          };

          return { lines: [...state.lines, line] };
        }),

      addService: (name, amount) =>
        set((state) => ({
          lines: [
            ...state.lines,
            {
              id: newLineId(),
              productId: null,
              name,
              unitPrice: amount,
              originalPrice: amount,
              quantity: 1,
              discount: 0,
              unit: "lần",
              isService: true,
            },
          ],
        })),

      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          lines: patchLine(state.lines, lineId, { quantity }),
        })),

      updateUnitPrice: (lineId, unitPrice) =>
        set((state) => ({
          lines: patchLine(state.lines, lineId, { unitPrice }),
        })),

      updateDiscount: (lineId, discount) =>
        set((state) => ({
          lines: patchLine(state.lines, lineId, { discount }),
        })),

      removeLine: (lineId) =>
        set((state) => ({
          lines: state.lines.filter((line) => line.id !== lineId),
        })),

      setOrderDiscount: (value) => set({ orderDiscount: value }),

      clear: () => set({ lines: [], orderDiscount: 0 }),
    }),
    {
      name: "an-phat-pos-current-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lines: state.lines,
        orderDiscount: state.orderDiscount,
      }),
    },
  ),
);

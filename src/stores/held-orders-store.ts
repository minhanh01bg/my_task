import { create } from "zustand";

import { calculateCart } from "@/lib/pricing/calculate";
import type { CartLine } from "@/lib/pricing/types";

export interface HeldOrder {
  id: string;
  lines: CartLine[];
  orderDiscount: number;
  heldAt: number;
  total: number;
}

interface HeldOrdersState {
  held: HeldOrder[];
  hold: (lines: CartLine[], orderDiscount: number) => void;
  resume: (id: string) => HeldOrder | null;
  discard: (id: string) => void;
}

/**
 * Giu don de tinh nhanh cho khach khac roi quay lai — VD khach bo quen vi,
 * hoac dang tinh do thi co khach sua xe can tra tien gap.
 *
 * Don giu chi nam trong may, chua len server.
 */
export const useHeldOrdersStore = create<HeldOrdersState>((set, get) => ({
  held: [],

  hold: (lines, orderDiscount) => {
    if (lines.length === 0) return;

    const totals = calculateCart(lines, orderDiscount);

    set((state) => ({
      held: [
        ...state.held,
        {
          id: crypto.randomUUID(),
          lines,
          orderDiscount,
          heldAt: Date.now(),
          total: totals.total,
        },
      ],
    }));
  },

  resume: (id) => {
    const found = get().held.find((order) => order.id === id);
    if (!found) return null;

    set((state) => ({
      held: state.held.filter((order) => order.id !== id),
    }));
    return found;
  },

  discard: (id) =>
    set((state) => ({
      held: state.held.filter((order) => order.id !== id),
    })),
}));

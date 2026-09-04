import { beforeEach, describe, expect, it } from "vitest";

import type { CartLine } from "@/lib/pricing/types";
import { useHeldOrdersStore } from "@/stores/held-orders-store";

function line(name = "Đường trắng", unitPrice = 15000): CartLine {
  return {
    id: crypto.randomUUID(),
    productId: "p1",
    name,
    unitPrice,
    originalPrice: unitPrice,
    quantity: 1,
    discount: 0,
    unit: "kg",
    isService: false,
  };
}

beforeEach(() => {
  useHeldOrdersStore.setState({ held: [] });
});

describe("giu don", () => {
  it("ban dau khong co don nao duoc giu", () => {
    expect(useHeldOrdersStore.getState().held).toEqual([]);
  });

  it("giu mot don", () => {
    useHeldOrdersStore.getState().hold([line()], 0);

    const { held } = useHeldOrdersStore.getState();
    expect(held).toHaveLength(1);
    expect(held[0]?.lines).toHaveLength(1);
    expect(held[0]?.total).toBe(15000);
  });

  it("giu don rong bi bo qua", () => {
    useHeldOrdersStore.getState().hold([], 0);
    expect(useHeldOrdersStore.getState().held).toHaveLength(0);
  });

  it("giu nhieu don cung luc", () => {
    useHeldOrdersStore.getState().hold([line("Đường trắng")], 0);
    useHeldOrdersStore.getState().hold([line("Nhớt Castrol")], 0);

    expect(useHeldOrdersStore.getState().held).toHaveLength(2);
  });

  it("tinh tong tien cua don giu de hien tren thanh", () => {
    useHeldOrdersStore
      .getState()
      .hold([line("A", 15000), line("B", 25000)], 0);
    expect(useHeldOrdersStore.getState().held[0]?.total).toBe(40000);
  });

  it("mo lai don thi tra ve noi dung va xoa khoi danh sach giu", () => {
    useHeldOrdersStore.getState().hold([line()], 5000);
    const id = useHeldOrdersStore.getState().held[0]!.id;

    const resumed = useHeldOrdersStore.getState().resume(id);

    expect(resumed?.lines).toHaveLength(1);
    expect(resumed?.orderDiscount).toBe(5000);
    expect(useHeldOrdersStore.getState().held).toHaveLength(0);
  });

  it("mo lai id khong ton tai tra ve null", () => {
    expect(useHeldOrdersStore.getState().resume("khong-co")).toBeNull();
  });

  it("bo mot don dang giu", () => {
    useHeldOrdersStore.getState().hold([line()], 0);
    const id = useHeldOrdersStore.getState().held[0]!.id;

    useHeldOrdersStore.getState().discard(id);

    expect(useHeldOrdersStore.getState().held).toHaveLength(0);
  });
});

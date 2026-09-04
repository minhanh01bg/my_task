import { beforeEach, describe, expect, it } from "vitest";

import { useCartStore } from "@/stores/cart-store";
import type { SearchableProduct } from "@/lib/search/types";

const sugar: SearchableProduct = {
  id: "p1",
  name: "Đường trắng",
  sku: null,
  price: 15000,
  unit: "kg",
  stock: 10,
  categoryId: null,
  soldCount: 0,
  searchText: "duong trang",
};

beforeEach(() => {
  useCartStore.getState().clear();
});

describe("cart store", () => {
  it("them san pham vao gio", () => {
    useCartStore.getState().addProduct(sugar);
    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.name).toBe("Đường trắng");
    expect(lines[0]?.quantity).toBe(1);
    expect(lines[0]?.unitPrice).toBe(15000);
    expect(lines[0]?.originalPrice).toBe(15000);
  });

  it("them lai mon da co thi tang so luong, khong tao dong moi", () => {
    useCartStore.getState().addProduct(sugar);
    useCartStore.getState().addProduct(sugar);
    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(2);
  });

  it("sua so luong nhan so thuc", () => {
    useCartStore.getState().addProduct(sugar);
    const lineId = useCartStore.getState().lines[0]!.id;
    useCartStore.getState().updateQuantity(lineId, 2.5);
    expect(useCartStore.getState().lines[0]?.quantity).toBe(2.5);
  });

  it("de gia van giu originalPrice", () => {
    useCartStore.getState().addProduct(sugar);
    const lineId = useCartStore.getState().lines[0]!.id;
    useCartStore.getState().updateUnitPrice(lineId, 12000);
    const line = useCartStore.getState().lines[0];
    expect(line?.unitPrice).toBe(12000);
    expect(line?.originalPrice).toBe(15000);
  });

  it("them dong dich vu khong gan productId", () => {
    useCartStore.getState().addService("Công thay nhớt", 20000);
    const line = useCartStore.getState().lines[0];
    expect(line?.productId).toBeNull();
    expect(line?.isService).toBe(true);
    expect(line?.unitPrice).toBe(20000);
    expect(line?.quantity).toBe(1);
  });

  it("hai dong dich vu cung ten van la hai dong rieng", () => {
    useCartStore.getState().addService("Công sửa", 20000);
    useCartStore.getState().addService("Công sửa", 30000);
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it("xoa mot dong", () => {
    useCartStore.getState().addProduct(sugar);
    const lineId = useCartStore.getState().lines[0]!.id;
    useCartStore.getState().removeLine(lineId);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("clear xoa ca gio va giam gia don", () => {
    useCartStore.getState().addProduct(sugar);
    useCartStore.getState().setOrderDiscount(5000);
    useCartStore.getState().clear();
    expect(useCartStore.getState().lines).toHaveLength(0);
    expect(useCartStore.getState().orderDiscount).toBe(0);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import {
  clearRecentlyViewed,
  getRecentlyViewed,
  recordRecentlyViewed,
} from "@/lib/storage/recently-viewed";

describe("recently-viewed storage utility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("trả về mảng rỗng khi chưa có sản phẩm nào được lưu", () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it("lưu sản phẩm vào danh sách vừa xem", () => {
    recordRecentlyViewed({
      id: "p1",
      name: "Sữa tươi tiệt trùng 1L",
      price: 32000,
      unit: "hộp",
      stock: 10,
      imageUrl: null,
    });

    const items = getRecentlyViewed();
    expect(items.length).toBe(1);
    expect(items[0].id).toBe("p1");
    expect(items[0].name).toBe("Sữa tươi tiệt trùng 1L");
  });

  it("đưa sản phẩm xem lại lên đầu danh sách và loại bỏ trùng lặp", () => {
    recordRecentlyViewed({
      id: "p1",
      name: "Sản phẩm 1",
      price: 10000,
      unit: "cái",
      stock: 5,
    });
    recordRecentlyViewed({
      id: "p2",
      name: "Sản phẩm 2",
      price: 20000,
      unit: "cái",
      stock: 5,
    });
    recordRecentlyViewed({
      id: "p1",
      name: "Sản phẩm 1",
      price: 10000,
      unit: "cái",
      stock: 5,
    });

    const items = getRecentlyViewed();
    expect(items.length).toBe(2);
    expect(items[0].id).toBe("p1");
    expect(items[1].id).toBe("p2");
  });

  it("giới hạn tối đa 8 sản phẩm gần nhất", () => {
    for (let i = 1; i <= 12; i++) {
      recordRecentlyViewed({
        id: `p${i}`,
        name: `Sản phẩm ${i}`,
        price: i * 1000,
        unit: "cái",
        stock: 5,
      });
    }

    const items = getRecentlyViewed();
    expect(items.length).toBe(8);
    expect(items[0].id).toBe("p12");
  });

  it("xóa sạch lịch sử vừa xem khi gọi clearRecentlyViewed", () => {
    recordRecentlyViewed({
      id: "p1",
      name: "Sản phẩm 1",
      price: 10000,
      unit: "cái",
      stock: 5,
    });
    expect(getRecentlyViewed().length).toBe(1);
    clearRecentlyViewed();
    expect(getRecentlyViewed()).toEqual([]);
  });
});

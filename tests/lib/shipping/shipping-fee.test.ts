import { describe, expect, it } from "vitest";

import {
  computeShippingFee,
  DEFAULT_SHIPPING_SETTINGS,
} from "@/lib/shipping/shipping-fee";

describe("computeShippingFee", () => {
  const settings = { shippingFee: 20_000, freeShippingThreshold: 200_000 };

  it("thu phí khi tạm tính dưới ngưỡng", () => {
    expect(computeShippingFee(199_999, settings)).toBe(20_000);
  });

  it("miễn phí từ ngưỡng trở lên", () => {
    expect(computeShippingFee(200_000, settings)).toBe(0);
    expect(computeShippingFee(500_000, settings)).toBe(0);
  });

  it("mặc định phí 0, ngưỡng 200.000", () => {
    expect(DEFAULT_SHIPPING_SETTINGS).toEqual({
      shippingFee: 0,
      freeShippingThreshold: 200_000,
    });
    expect(computeShippingFee(10_000, DEFAULT_SHIPPING_SETTINGS)).toBe(0);
  });
});

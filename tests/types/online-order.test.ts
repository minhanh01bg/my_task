import { describe, expect, it } from "vitest";

import { onlineCheckoutSchema } from "@/types/online-order";

const valid = {
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  lines: [{ productId: "product-1", quantity: 2 }],
  contactName: "Nguyễn Văn An",
  contactPhone: "0901 234 567",
  fulfillmentType: "delivery",
  paymentMethod: "cod",
  deliveryAddress: "12 Nguyễn Huệ",
  deliveryDistrict: "Quận 1",
  deliveryProvince: "TP.HCM",
};

describe("onlineCheckoutSchema", () => {
  it("chuẩn hóa checkout giao tận nơi", () => {
    const result = onlineCheckoutSchema.parse(valid);
    expect(result.contactPhone).toBe("0901234567");
  });

  it("chấp nhận pickup không địa chỉ", () => {
    expect(
      onlineCheckoutSchema.safeParse({
        ...valid,
        fulfillmentType: "pickup",
        deliveryAddress: "",
        deliveryDistrict: "",
        deliveryProvince: "",
      }).success,
    ).toBe(true);
  });

  it("từ chối delivery thiếu địa chỉ", () => {
    expect(
      onlineCheckoutSchema.safeParse({ ...valid, deliveryAddress: "" }).success,
    ).toBe(false);
  });

  it("từ chối field giá và dòng trùng", () => {
    expect(onlineCheckoutSchema.safeParse({ ...valid, total: 1 }).success).toBe(
      false,
    );
    expect(
      onlineCheckoutSchema.safeParse({
        ...valid,
        lines: [valid.lines[0], valid.lines[0]],
      }).success,
    ).toBe(false);
  });
});

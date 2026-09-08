import { describe, expect, it } from "vitest";

import { onlineCheckoutSchema } from "@/types/online-order";

const valid = {
  clientId: "550e8400-e29b-41d4-a716-446655440000",
  lines: [{ productId: "product-1", quantity: 2 }],
  contactName: "Nguyễn Văn An",
  contactPhone: "0901 234 567",
  fulfillmentType: "delivery" as const,
  paymentMethod: "cod" as const,
  deliveryAddress: "12 Nguyễn Huệ",
  deliveryWard: "Phường Bến Nghé",
  deliveryDistrict: "Quận 1",
  deliveryProvince: "TP. Hồ Chí Minh",
};

describe("onlineCheckoutSchema", () => {
  it("chuẩn hóa checkout giao tận nơi", () => {
    const result = onlineCheckoutSchema.parse(valid);
    expect(result.contactPhone).toBe("0901234567");
    expect(result.deliveryWard).toBe("Phường Bến Nghé");
  });

  it("chấp nhận pickup không địa chỉ", () => {
    expect(
      onlineCheckoutSchema.safeParse({
        ...valid,
        fulfillmentType: "pickup",
        deliveryAddress: "",
        deliveryWard: "",
        deliveryDistrict: "",
        deliveryProvince: "",
      }).success,
    ).toBe(true);
  });

  it("từ chối delivery thiếu địa chỉ hoặc thiếu phường/xã", () => {
    expect(
      onlineCheckoutSchema.safeParse({ ...valid, deliveryAddress: "" }).success,
    ).toBe(false);

    expect(
      onlineCheckoutSchema.safeParse({ ...valid, deliveryWard: "" }).success,
    ).toBe(false);

    expect(
      onlineCheckoutSchema.safeParse({ ...valid, deliveryDistrict: "" })
        .success,
    ).toBe(false);

    expect(
      onlineCheckoutSchema.safeParse({ ...valid, deliveryProvince: "" })
        .success,
    ).toBe(false);
  });

  it("chấp nhận structured address codes hợp lệ", () => {
    const result = onlineCheckoutSchema.safeParse({
      ...valid,
      provinceCode: "79",
      districtCode: "760",
      wardCode: "26734",
    });
    expect(result.success).toBe(true);
  });

  it("từ chối mã hành chính không tồn tại hoặc không khớp cấu trúc", () => {
    // Mã tỉnh giả
    expect(
      onlineCheckoutSchema.safeParse({
        ...valid,
        provinceCode: "999",
      }).success,
    ).toBe(false);

    // Quận Ba Đình (001) thuộc Hà Nội (01), nhưng khai provinceCode 79 (TP.HCM)
    expect(
      onlineCheckoutSchema.safeParse({
        ...valid,
        provinceCode: "79",
        districtCode: "001",
      }).success,
    ).toBe(false);
  });

  it("từ chối field giả hoặc field nhạy cảm ngoài schema (strict)", () => {
    expect(onlineCheckoutSchema.safeParse({ ...valid, total: 1 }).success).toBe(
      false,
    );
    expect(
      onlineCheckoutSchema.safeParse({ ...valid, fakeField: "invalid" })
        .success,
    ).toBe(false);
    expect(
      onlineCheckoutSchema.safeParse({
        ...valid,
        lines: [valid.lines[0], valid.lines[0]],
      }).success,
    ).toBe(false);
  });
});

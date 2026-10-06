import { describe, expect, it } from "vitest";

import {
  formatFullAddress,
  getProvinces,
  getWards,
  validateAddressHierarchy,
} from "@/lib/address/vietnam-address";

describe("Địa chỉ hành chính hai cấp hiện hành", () => {
  it("có 34 mã cấp tỉnh duy nhất và Bắc Ninh mã 24, không còn tỉnh Bắc Giang", () => {
    const provinces = getProvinces();
    expect(provinces).toHaveLength(34);
    expect(new Set(provinces.map((p) => p.code)).size).toBe(34);
    expect(provinces.find((p) => p.code === "24")?.name).toBe(
      "Thành phố Bắc Ninh",
    );
    expect(provinces.some((p) => p.name === "Bắc Giang")).toBe(false);
  });
  it("có 3321 xã/phường với mã duy nhất và thuộc tỉnh tồn tại", () => {
    const wards = getProvinces().flatMap((p) => getWards(p.code));
    expect(wards).toHaveLength(3321);
    expect(new Set(wards.map((w) => w.code)).size).toBe(3321);
    expect(getWards("24").find((w) => w.code === "07210")?.name).toBe(
      "Phường Bắc Giang",
    );
    expect(getWards("invalid")).toEqual([]);
  });
  it("chấp nhận địa chỉ Bắc Giang mới không có quận/huyện", () => {
    expect(
      validateAddressHierarchy({
        provinceCode: "24",
        wardCode: "07210",
        provinceName: "Thành phố Bắc Ninh",
        wardName: "Phường Bắc Giang",
      }),
    ).toEqual({ valid: true });
  });
  it.each([
    { provinceCode: "999" },
    { provinceCode: "01", wardCode: "07210" },
    { wardCode: "07210" },
    { provinceCode: "24", wardCode: "99999" },
    { provinceCode: "24", provinceName: "Bắc Giang" },
    { provinceCode: "24", wardCode: "07210", wardName: "Phường Đa Mai" },
    { provinceCode: "24", provinceName: "Ninh" },
    { provinceCode: "24", districtCode: "213" },
  ])("từ chối cấu trúc/mã/tên sai %j", (input) => {
    expect(validateAddressHierarchy(input).valid).toBe(false);
  });
  it("chấp nhận tên không có tiền tố và cho phép nhập tay không mã", () => {
    expect(
      validateAddressHierarchy({
        provinceCode: "24",
        wardCode: "07210",
        provinceName: "Bắc Ninh",
        wardName: "Bắc Giang",
      }).valid,
    ).toBe(true);
    expect(
      validateAddressHierarchy({
        provinceName: "Bắc Ninh",
        wardName: "Bắc Giang",
      }).valid,
    ).toBe(true);
  });
  it("định dạng hai cấp và vẫn giữ địa chỉ lịch sử có huyện", () => {
    expect(
      formatFullAddress({
        street: "12 Lê Lợi",
        ward: "Phường Bắc Giang",
        province: "Thành phố Bắc Ninh",
      }),
    ).toBe("12 Lê Lợi, Phường Bắc Giang, Thành phố Bắc Ninh");
    expect(
      formatFullAddress({
        street: "12 Lê Lợi",
        ward: "Phường Bến Nghé",
        district: "Quận 1",
        province: "TP. Hồ Chí Minh",
      }),
    ).toContain("Quận 1");
  });
});

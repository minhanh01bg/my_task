import { describe, expect, it } from "vitest";

import {
  formatFullAddress,
  getDistricts,
  getProvinces,
  getWards,
  validateAddressHierarchy,
} from "@/lib/address/vietnam-address";

describe("Vietnam Administrative Address Dataset & Validation", () => {
  it("trả về danh sách 63 tỉnh/thành phố Việt Nam với mã và tên duy nhất", () => {
    const provinces = getProvinces();
    expect(provinces.length).toBe(63);

    const codes = new Set(provinces.map((p) => p.code));
    expect(codes.size).toBe(63);

    const hanoi = provinces.find((p) => p.code === "01");
    expect(hanoi?.name).toBe("Hà Nội");

    const hcm = provinces.find((p) => p.code === "79");
    expect(hcm?.name).toBe("TP. Hồ Chí Minh");

    const danang = provinces.find((p) => p.code === "48");
    expect(danang?.name).toBe("Đà Nẵng");
  });

  it("trả về danh sách quận/huyện thuộc tỉnh/thành phố tương ứng", () => {
    const hanoiDistricts = getDistricts("01");
    expect(hanoiDistricts.length).toBeGreaterThan(0);
    expect(hanoiDistricts.every((d) => d.provinceCode === "01")).toBe(true);
    expect(hanoiDistricts.some((d) => d.name === "Ba Đình")).toBe(true);
    expect(hanoiDistricts.some((d) => d.name === "Cầu Giấy")).toBe(true);

    const hcmDistricts = getDistricts("79");
    expect(hcmDistricts.length).toBeGreaterThan(0);
    expect(hcmDistricts.every((d) => d.provinceCode === "79")).toBe(true);
    expect(hcmDistricts.some((d) => d.name === "Quận 1")).toBe(true);
    expect(hcmDistricts.some((d) => d.name === "Bình Thạnh")).toBe(true);

    // Tỉnh không tồn tại trả về mảng rỗng
    expect(getDistricts("invalid-code")).toEqual([]);
  });

  it("trả về danh sách phường/xã thuộc quận/huyện tương ứng", () => {
    const q1Districts = getDistricts("79");
    const q1 = q1Districts.find((d) => d.name === "Quận 1")!;
    expect(q1).toBeDefined();

    const q1Wards = getWards(q1.code);
    expect(q1Wards.length).toBeGreaterThan(0);
    expect(q1Wards.every((w) => w.districtCode === q1.code)).toBe(true);
    expect(q1Wards.some((w) => w.name.includes("Bến Nghé"))).toBe(true);

    // Quận không tồn tại trả về mảng rỗng
    expect(getWards("invalid-district")).toEqual([]);
  });

  it("validateAddressHierarchy: chấp nhận tổ hợp hợp lệ", () => {
    const result = validateAddressHierarchy({
      provinceCode: "79",
      districtCode: "760",
      wardCode: "26734",
      provinceName: "TP. Hồ Chí Minh",
      districtName: "Quận 1",
      wardName: "Phường Bến Nghé",
    });
    expect(result.valid).toBe(true);
  });

  it("validateAddressHierarchy: từ chối mã tỉnh không tồn tại", () => {
    const result = validateAddressHierarchy({
      provinceCode: "999",
      districtCode: "760",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("tỉnh");
  });

  it("validateAddressHierarchy: từ chối quận không thuộc tỉnh", () => {
    // 001 là Ba Đình (Hà Nội "01"), nhưng gửi provinceCode là TP.HCM "79"
    const result = validateAddressHierarchy({
      provinceCode: "79",
      districtCode: "001",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("quận/huyện");
  });

  it("validateAddressHierarchy: từ chối phường không thuộc quận", () => {
    // 00001 thuộc Ba Đình (Hà Nội), nhưng gửi districtCode là Quận 1 (TP.HCM)
    const result = validateAddressHierarchy({
      provinceCode: "79",
      districtCode: "760",
      wardCode: "00001",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("phường/xã");
  });

  it("validateAddressHierarchy: từ chối khi tên không khớp với mã", () => {
    const result = validateAddressHierarchy({
      provinceCode: "79",
      provinceName: "Hà Nội", // Mã 79 nhưng tên Hà Nội
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("tên tỉnh");
  });

  it("formatFullAddress: định dạng chuỗi địa chỉ đầy đủ chuẩn Việt Nam", () => {
    const full = formatFullAddress({
      street: "123 Lê Lợi",
      ward: "Phường Bến Nghé",
      district: "Quận 1",
      province: "TP. Hồ Chí Minh",
    });
    expect(full).toBe("123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh");
  });

  it("formatFullAddress: bỏ qua các phần tử trống một cách an toàn", () => {
    const partial = formatFullAddress({
      street: "123 Lê Lợi",
      ward: "",
      district: "Quận 1",
      province: "TP. Hồ Chí Minh",
    });
    expect(partial).toBe("123 Lê Lợi, Quận 1, TP. Hồ Chí Minh");
  });
});

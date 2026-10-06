import type {
  AdministrativeProvince,
  AdministrativeWard,
} from "@/types/address";

import dataset from "./vietnam-administrative.json";

/** Snapshot Cục Thống kê ngày 06/10/2026; xã/phường trực thuộc cấp tỉnh. */
export function getProvinces(): AdministrativeProvince[] {
  return dataset.provinces;
}

export function getWards(provinceCode: string): AdministrativeWard[] {
  return dataset.wards.filter((ward) => ward.provinceCode === provinceCode);
}

export function findProvinceByCode(
  code: string,
): AdministrativeProvince | undefined {
  return dataset.provinces.find((province) => province.code === code);
}

export function findWardByCode(
  code: string,
  provinceCode?: string,
): AdministrativeWard | undefined {
  return dataset.wards.find(
    (ward) =>
      ward.code === code &&
      (!provinceCode || ward.provinceCode === provinceCode),
  );
}

function normalizeAdminName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("vi-VN")
    .replace(/^(tỉnh|thành phố|tp\.|phường|xã|đặc khu)\s+/i, "")
    .replace(/\s+/g, " ");
}

export interface AddressValidationInput {
  provinceCode?: string;
  /** Mã huyện cũ chỉ được giữ để phát hiện client cần cập nhật. */
  districtCode?: string;
  wardCode?: string;
  provinceName?: string;
  districtName?: string;
  wardName?: string;
}

export interface AddressValidationResult {
  valid: boolean;
  error?: string;
}

export function validateAddressHierarchy(
  input: AddressValidationInput,
): AddressValidationResult {
  if (input.districtCode)
    return {
      valid: false,
      error:
        "Danh mục quận/huyện đã thay đổi. Vui lòng tải lại trang và chọn địa chỉ hai cấp.",
    };
  if (!input.provinceCode && !input.wardCode) return { valid: true };
  if (!input.provinceCode || !input.wardCode)
    return {
      valid: false,
      error: "Vui lòng chọn đầy đủ tỉnh/thành phố và phường/xã.",
    };
  const province = findProvinceByCode(input.provinceCode);
  if (!province)
    return { valid: false, error: "Mã tỉnh/thành phố không tồn tại" };
  if (
    input.provinceName &&
    normalizeAdminName(input.provinceName) !== normalizeAdminName(province.name)
  )
    return {
      valid: false,
      error: "Tên tỉnh/thành phố không khớp với mã hành chính",
    };
  const ward = findWardByCode(input.wardCode, input.provinceCode);
  if (!ward)
    return {
      valid: false,
      error:
        "Mã phường/xã không tồn tại hoặc không thuộc tỉnh/thành phố đã chọn",
    };
  if (
    input.wardName &&
    normalizeAdminName(input.wardName) !== normalizeAdminName(ward.name)
  )
    return {
      valid: false,
      error: "Tên phường/xã không khớp với mã hành chính",
    };
  return { valid: true };
}

export function formatFullAddress(parts: {
  street?: string;
  ward?: string;
  district?: string;
  province?: string;
}): string {
  const elements = [parts.street, parts.ward, parts.district, parts.province]
    .map((s) => s?.trim())
    .filter(Boolean);

  return elements.join(", ");
}

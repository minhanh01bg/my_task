"use client";

import { useId, useMemo } from "react";

import {
  getDistricts,
  getProvinces,
  getWards,
} from "@/lib/address/vietnam-address";

export interface AddressState {
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  provinceName: string;
  districtName: string;
  wardName: string;
  street: string;
  isManual: boolean;
}

export interface AddressFieldsProps {
  value: AddressState;
  onChange: (next: AddressState) => void;
  inputClass?: string;
}

export function AddressFields({
  value,
  onChange,
  inputClass = "border-input bg-background h-12 w-full rounded-xl border px-3 outline-none focus-visible:ring-3",
}: AddressFieldsProps) {
  const provinceInputId = useId();
  const districtInputId = useId();
  const wardInputId = useId();
  const streetInputId = useId();

  const provinces = useMemo(() => getProvinces(), []);
  const districts = useMemo(
    () => (value.provinceCode ? getDistricts(value.provinceCode) : []),
    [value.provinceCode],
  );
  const wards = useMemo(
    () => (value.districtCode ? getWards(value.districtCode) : []),
    [value.districtCode],
  );

  function handleProvinceSelect(code: string) {
    const selected = provinces.find((p) => p.code === code);
    onChange({
      ...value,
      provinceCode: code,
      provinceName: selected ? selected.name : "",
      districtCode: "",
      districtName: "",
      wardCode: "",
      wardName: "",
    });
  }

  function handleDistrictSelect(code: string) {
    const selected = districts.find((d) => d.code === code);
    onChange({
      ...value,
      districtCode: code,
      districtName: selected ? selected.name : "",
      wardCode: "",
      wardName: "",
    });
  }

  function handleWardSelect(code: string) {
    const selected = wards.find((w) => w.code === code);
    onChange({
      ...value,
      wardCode: code,
      wardName: selected ? selected.name : "",
    });
  }

  function toggleManual() {
    onChange({
      ...value,
      isManual: !value.isManual,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {value.isManual
            ? "Đang ở chế độ nhập tay tự do"
            : "Chọn từ danh mục chuẩn 63 tỉnh/thành"}
        </span>
        <button
          type="button"
          onClick={toggleManual}
          className="text-primary text-sm font-medium hover:underline"
        >
          {value.isManual ? "Chọn từ danh mục" : "Nhập thủ công"}
        </button>
      </div>

      {/* Hidden inputs to guarantee FormData serialization regardless of mode */}
      <input type="hidden" name="deliveryProvince" value={value.provinceName} />
      <input type="hidden" name="deliveryDistrict" value={value.districtName} />
      <input type="hidden" name="deliveryWard" value={value.wardName} />
      {!value.isManual && value.provinceCode ? (
        <input type="hidden" name="provinceCode" value={value.provinceCode} />
      ) : null}
      {!value.isManual && value.districtCode ? (
        <input type="hidden" name="districtCode" value={value.districtCode} />
      ) : null}
      {!value.isManual && value.wardCode ? (
        <input type="hidden" name="wardCode" value={value.wardCode} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Tỉnh / Thành phố */}
        <div>
          <label htmlFor={provinceInputId} className="block font-bold">
            Tỉnh/thành phố <span className="text-destructive">*</span>
          </label>
          {value.isManual ? (
            <input
              id={provinceInputId}
              required
              aria-required="true"
              value={value.provinceName}
              onChange={(e) =>
                onChange({ ...value, provinceName: e.target.value })
              }
              placeholder="Ví dụ: TP. Hồ Chí Minh"
              className={`${inputClass} mt-2`}
            />
          ) : (
            <select
              id={provinceInputId}
              required
              aria-required="true"
              value={value.provinceCode}
              onChange={(e) => handleProvinceSelect(e.target.value)}
              className={`${inputClass} mt-2`}
            >
              <option value="">-- Chọn Tỉnh/Thành phố --</option>
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Quận / Huyện */}
        <div>
          <label htmlFor={districtInputId} className="block font-bold">
            Quận/huyện <span className="text-destructive">*</span>
          </label>
          {value.isManual ? (
            <input
              id={districtInputId}
              required
              aria-required="true"
              value={value.districtName}
              onChange={(e) =>
                onChange({ ...value, districtName: e.target.value })
              }
              placeholder="Ví dụ: Quận 1"
              className={`${inputClass} mt-2`}
            />
          ) : (
            <select
              id={districtInputId}
              required
              aria-required="true"
              disabled={!value.provinceCode}
              value={value.districtCode}
              onChange={(e) => handleDistrictSelect(e.target.value)}
              className={`${inputClass} mt-2 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <option value="">
                {value.provinceCode
                  ? "-- Chọn Quận/Huyện --"
                  : "-- Vui lòng chọn Tỉnh trước --"}
              </option>
              {districts.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Phường / Xã */}
      <div>
        <label htmlFor={wardInputId} className="block font-bold">
          Phường/xã <span className="text-destructive">*</span>
        </label>
        {value.isManual ? (
          <input
            id={wardInputId}
            required
            aria-required="true"
            value={value.wardName}
            onChange={(e) => onChange({ ...value, wardName: e.target.value })}
            placeholder="Ví dụ: Phường Bến Nghé"
            className={`${inputClass} mt-2`}
          />
        ) : (
          <select
            id={wardInputId}
            required
            aria-required="true"
            disabled={!value.districtCode}
            value={value.wardCode}
            onChange={(e) => handleWardSelect(e.target.value)}
            className={`${inputClass} mt-2 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <option value="">
              {value.districtCode
                ? "-- Chọn Phường/Xã --"
                : "-- Vui lòng chọn Quận/Huyện trước --"}
            </option>
            {wards.map((w) => (
              <option key={w.code} value={w.code}>
                {w.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Số nhà / Đường */}
      <div>
        <label htmlFor={streetInputId} className="block font-bold">
          Số nhà, tên đường (Địa chỉ cụ thể){" "}
          <span className="text-destructive">*</span>
        </label>
        <input
          id={streetInputId}
          name="deliveryAddress"
          required
          aria-required="true"
          value={value.street}
          onChange={(e) => onChange({ ...value, street: e.target.value })}
          placeholder="Ví dụ: 123 Lê Lợi, Tòa nhà Bitexco..."
          className={`${inputClass} mt-2`}
        />
      </div>
    </div>
  );
}

"use client";

import { useId, useMemo } from "react";

import { getProvinces, getWards } from "@/lib/address/vietnam-address";
import { DropdownField } from "@/components/kit/dropdown-field";

export interface AddressState {
  provinceCode: string;
  wardCode: string;
  provinceName: string;
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
  const wardInputId = useId();
  const streetInputId = useId();

  const provinces = useMemo(() => getProvinces(), []);
  const wards = useMemo(
    () => (value.provinceCode ? getWards(value.provinceCode) : []),
    [value.provinceCode],
  );

  const provinceOptions = useMemo(
    () => provinces.map((p) => ({ value: p.code, label: p.name })),
    [provinces],
  );
  const wardOptions = useMemo(
    () => wards.map((w) => ({ value: w.code, label: w.name })),
    [wards],
  );

  function handleProvinceSelect(code: string) {
    const selected = provinces.find((p) => p.code === code);
    onChange({
      ...value,
      provinceCode: code,
      provinceName: selected ? selected.name : "",
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
      ...(value.isManual
        ? { provinceCode: "", wardCode: "", provinceName: "", wardName: "" }
        : {}),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          {value.isManual
            ? "Đang ở chế độ nhập tay tự do"
            : "Chọn địa chỉ hành chính hai cấp (34 tỉnh/thành)"}
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
      <input type="hidden" name="deliveryWard" value={value.wardName} />
      {!value.isManual && value.provinceCode ? (
        <input type="hidden" name="provinceCode" value={value.provinceCode} />
      ) : null}
      {!value.isManual && value.wardCode ? (
        <input type="hidden" name="wardCode" value={value.wardCode} />
      ) : null}

      <div className="grid gap-4">
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
            <DropdownField
              id={provinceInputId}
              aria-label="Tỉnh/thành phố"
              placeholder="-- Chọn Tỉnh/Thành phố --"
              value={value.provinceCode}
              onValueChange={(code) => {
                if (code) handleProvinceSelect(code);
              }}
              options={provinceOptions}
              className="mt-2"
            />
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
            placeholder="Ví dụ: Phường Bắc Giang"
            className={`${inputClass} mt-2`}
          />
        ) : (
          <DropdownField
            id={wardInputId}
            aria-label="Phường/xã"
            placeholder={
              value.provinceCode
                ? "-- Chọn Phường/Xã --"
                : "-- Vui lòng chọn Tỉnh/Thành phố trước --"
            }
            value={value.wardCode}
            onValueChange={(code) => {
              if (code) handleWardSelect(code);
            }}
            options={wardOptions}
            disabled={!value.provinceCode || wards.length === 0}
            className="mt-2"
          />
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

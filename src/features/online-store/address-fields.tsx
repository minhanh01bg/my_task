"use client";

import { useId, useMemo } from "react";

import { getProvinces, getWards } from "@/lib/address/vietnam-address";
import { AddressCombobox } from "@/components/kit/address-combobox";

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
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-muted-foreground text-sm">
          {value.isManual
            ? "Đang ở chế độ nhập tay tự do"
            : "Chọn địa chỉ hành chính hai cấp (34 tỉnh/thành)"}
        </span>
        <button
          type="button"
          onClick={toggleManual}
          className="text-primary min-h-11 shrink-0 text-sm font-medium hover:underline"
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

      <div className="grid min-w-0 grid-cols-1 gap-4">
        {/* Tỉnh / Thành phố */}
        <div className="min-w-0">
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
            <AddressCombobox
              id={provinceInputId}
              label="Tỉnh/thành phố"
              placeholder="Gõ tìm tỉnh/thành phố"
              value={value.provinceCode}
              onValueChange={handleProvinceSelect}
              options={provinceOptions}
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
          <AddressCombobox
            id={wardInputId}
            label="Phường/xã"
            placeholder={
              value.provinceCode
                ? "Gõ tìm phường/xã/đặc khu"
                : "Chọn tỉnh/thành phố trước"
            }
            value={value.wardCode}
            onValueChange={handleWardSelect}
            options={wardOptions}
            disabled={!value.provinceCode || wards.length === 0}
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

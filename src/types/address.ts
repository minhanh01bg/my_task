export interface AdministrativeProvince {
  code: string;
  name: string;
}

export interface AdministrativeDistrict {
  code: string;
  provinceCode: string;
  name: string;
}

export interface AdministrativeWard {
  code: string;
  districtCode: string;
  name: string;
}

export interface StructuredAddressSelection {
  provinceCode?: string;
  districtCode?: string;
  wardCode?: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  isManual?: boolean;
}

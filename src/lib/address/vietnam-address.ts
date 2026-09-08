import type {
  AdministrativeDistrict,
  AdministrativeProvince,
  AdministrativeWard,
} from "@/types/address";

export const VIETNAM_PROVINCES: AdministrativeProvince[] = [
  { code: "01", name: "Hà Nội" },
  { code: "02", name: "Hà Giang" },
  { code: "04", name: "Cao Bằng" },
  { code: "06", name: "Bắc Kạn" },
  { code: "08", name: "Tuyên Quang" },
  { code: "10", name: "Lào Cai" },
  { code: "11", name: "Điện Biên" },
  { code: "12", name: "Lai Châu" },
  { code: "14", name: "Sơn La" },
  { code: "15", name: "Yên Bái" },
  { code: "17", name: "Hòa Bình" },
  { code: "19", name: "Thái Nguyên" },
  { code: "20", name: "Lạng Sơn" },
  { code: "22", name: "Quảng Ninh" },
  { code: "24", name: "Bắc Giang" },
  { code: "25", name: "Phú Thọ" },
  { code: "26", name: "Vĩnh Phúc" },
  { code: "27", name: "Bắc Ninh" },
  { code: "30", name: "Hải Dương" },
  { code: "31", name: "Hải Phòng" },
  { code: "33", name: "Hưng Yên" },
  { code: "34", name: "Thái Bình" },
  { code: "35", name: "Hà Nam" },
  { code: "36", name: "Nam Định" },
  { code: "37", name: "Ninh Bình" },
  { code: "38", name: "Thanh Hóa" },
  { code: "40", name: "Nghệ An" },
  { code: "42", name: "Hà Tĩnh" },
  { code: "44", name: "Quảng Bình" },
  { code: "45", name: "Quảng Trị" },
  { code: "46", name: "Thừa Thiên Huế" },
  { code: "48", name: "Đà Nẵng" },
  { code: "49", name: "Quảng Nam" },
  { code: "51", name: "Quảng Ngãi" },
  { code: "52", name: "Bình Định" },
  { code: "54", name: "Phú Yên" },
  { code: "56", name: "Khánh Hòa" },
  { code: "58", name: "Ninh Thuận" },
  { code: "60", name: "Bình Thuận" },
  { code: "62", name: "Kon Tum" },
  { code: "64", name: "Gia Lai" },
  { code: "66", name: "Đắk Lắk" },
  { code: "67", name: "Đắk Nông" },
  { code: "68", name: "Lâm Đồng" },
  { code: "70", name: "Bình Phước" },
  { code: "72", name: "Tây Ninh" },
  { code: "74", name: "Bình Dương" },
  { code: "75", name: "Đồng Nai" },
  { code: "77", name: "Bà Rịa - Vũng Tàu" },
  { code: "79", name: "TP. Hồ Chí Minh" },
  { code: "80", name: "Long An" },
  { code: "82", name: "Tiền Giang" },
  { code: "83", name: "Bến Tre" },
  { code: "84", name: "Trà Vinh" },
  { code: "86", name: "Vĩnh Long" },
  { code: "87", name: "Đồng Tháp" },
  { code: "88", name: "An Giang" },
  { code: "89", name: "Kiên Giang" },
  { code: "91", name: "Cần Thơ" },
  { code: "92", name: "Hậu Giang" },
  { code: "93", name: "Sóc Trăng" },
  { code: "94", name: "Bạc Liêu" },
  { code: "96", name: "Cà Mau" },
];

export const VIETNAM_DISTRICTS: AdministrativeDistrict[] = [
  // Hà Nội (01)
  { code: "001", provinceCode: "01", name: "Ba Đình" },
  { code: "002", provinceCode: "01", name: "Hoàn Kiếm" },
  { code: "003", provinceCode: "01", name: "Tây Hồ" },
  { code: "004", provinceCode: "01", name: "Long Biên" },
  { code: "005", provinceCode: "01", name: "Cầu Giấy" },
  { code: "006", provinceCode: "01", name: "Đống Đa" },
  { code: "007", provinceCode: "01", name: "Hai Bà Trưng" },
  { code: "008", provinceCode: "01", name: "Hoàng Mai" },
  { code: "009", provinceCode: "01", name: "Thanh Xuân" },
  { code: "016", provinceCode: "01", name: "Sóc Sơn" },
  { code: "017", provinceCode: "01", name: "Đông Anh" },
  { code: "018", provinceCode: "01", name: "Gia Lâm" },
  { code: "019", provinceCode: "01", name: "Nam Từ Liêm" },
  { code: "020", provinceCode: "01", name: "Thanh Trì" },
  { code: "021", provinceCode: "01", name: "Bắc Từ Liêm" },
  { code: "250", provinceCode: "01", name: "Mê Linh" },
  { code: "268", provinceCode: "01", name: "Hà Đông" },
  { code: "269", provinceCode: "01", name: "Sơn Tây" },
  { code: "271", provinceCode: "01", name: "Ba Vì" },
  { code: "272", provinceCode: "01", name: "Phúc Thọ" },
  { code: "273", provinceCode: "01", name: "Đan Phượng" },
  { code: "274", provinceCode: "01", name: "Hoài Đức" },
  { code: "275", provinceCode: "01", name: "Quốc Oai" },
  { code: "276", provinceCode: "01", name: "Thạch Thất" },
  { code: "277", provinceCode: "01", name: "Chương Mỹ" },
  { code: "278", provinceCode: "01", name: "Thanh Oai" },
  { code: "279", provinceCode: "01", name: "Thường Tín" },
  { code: "280", provinceCode: "01", name: "Phú Xuyên" },
  { code: "281", provinceCode: "01", name: "Ứng Hòa" },
  { code: "282", provinceCode: "01", name: "Mỹ Đức" },

  // TP. Hồ Chí Minh (79)
  { code: "760", provinceCode: "79", name: "Quận 1" },
  { code: "761", provinceCode: "79", name: "Quận 12" },
  { code: "764", provinceCode: "79", name: "Gò Vấp" },
  { code: "765", provinceCode: "79", name: "Bình Thạnh" },
  { code: "766", provinceCode: "79", name: "Tân Bình" },
  { code: "767", provinceCode: "79", name: "Tân Phú" },
  { code: "768", provinceCode: "79", name: "Phú Nhuận" },
  { code: "769", provinceCode: "79", name: "TP. Thủ Đức" },
  { code: "770", provinceCode: "79", name: "Quận 3" },
  { code: "771", provinceCode: "79", name: "Quận 10" },
  { code: "772", provinceCode: "79", name: "Quận 11" },
  { code: "773", provinceCode: "79", name: "Quận 4" },
  { code: "774", provinceCode: "79", name: "Quận 5" },
  { code: "775", provinceCode: "79", name: "Quận 6" },
  { code: "776", provinceCode: "79", name: "Quận 8" },
  { code: "777", provinceCode: "79", name: "Bình Tân" },
  { code: "778", provinceCode: "79", name: "Quận 7" },
  { code: "783", provinceCode: "79", name: "Củ Chi" },
  { code: "784", provinceCode: "79", name: "Hóc Môn" },
  { code: "785", provinceCode: "79", name: "Bình Chánh" },
  { code: "786", provinceCode: "79", name: "Nhà Bè" },
  { code: "787", provinceCode: "79", name: "Cần Giờ" },

  // Hải Phòng (31)
  { code: "303", provinceCode: "31", name: "Hồng Bàng" },
  { code: "304", provinceCode: "31", name: "Ngô Quyền" },
  { code: "305", provinceCode: "31", name: "Lê Chân" },
  { code: "306", provinceCode: "31", name: "Hải An" },
  { code: "307", provinceCode: "31", name: "Kiến An" },
  { code: "308", provinceCode: "31", name: "Đồ Sơn" },
  { code: "309", provinceCode: "31", name: "Dương Kinh" },
  { code: "311", provinceCode: "31", name: "Thủy Nguyên" },
  { code: "312", provinceCode: "31", name: "An Dương" },
  { code: "313", provinceCode: "31", name: "An Lão" },
  { code: "314", provinceCode: "31", name: "Kiến Thụy" },
  { code: "315", provinceCode: "31", name: "Tiên Lãng" },
  { code: "316", provinceCode: "31", name: "Vĩnh Bảo" },
  { code: "317", provinceCode: "31", name: "Cát Hải" },

  // Đà Nẵng (48)
  { code: "490", provinceCode: "48", name: "Hải Châu" },
  { code: "491", provinceCode: "48", name: "Thanh Khê" },
  { code: "492", provinceCode: "48", name: "Sơn Trà" },
  { code: "493", provinceCode: "48", name: "Ngũ Hành Sơn" },
  { code: "494", provinceCode: "48", name: "Liên Chiểu" },
  { code: "495", provinceCode: "48", name: "Cẩm Lệ" },
  { code: "497", provinceCode: "48", name: "Hòa Vang" },

  // Cần Thơ (91)
  { code: "916", provinceCode: "91", name: "Ninh Kiều" },
  { code: "917", provinceCode: "91", name: "Ô Môn" },
  { code: "918", provinceCode: "91", name: "Bình Thủy" },
  { code: "919", provinceCode: "91", name: "Cái Răng" },
  { code: "923", provinceCode: "91", name: "Thốt Nốt" },
  { code: "924", provinceCode: "91", name: "Vĩnh Thạnh" },
  { code: "925", provinceCode: "91", name: "Cờ Đỏ" },
  { code: "926", provinceCode: "91", name: "Phong Điền" },
  { code: "927", provinceCode: "91", name: "Thới Lai" },

  // Bình Dương (74)
  { code: "718", provinceCode: "74", name: "Thủ Dầu Một" },
  { code: "721", provinceCode: "74", name: "Dĩ An" },
  { code: "722", provinceCode: "74", name: "Thuận An" },
  { code: "723", provinceCode: "74", name: "Bến Cát" },
  { code: "724", provinceCode: "74", name: "Tân Uyên" },
  { code: "725", provinceCode: "74", name: "Bắc Tân Uyên" },
  { code: "726", provinceCode: "74", name: "Bàu Bàng" },

  // Đồng Nai (75)
  { code: "731", provinceCode: "75", name: "Biên Hòa" },
  { code: "732", provinceCode: "75", name: "Long Khánh" },
  { code: "734", provinceCode: "75", name: "Long Thành" },
  { code: "735", provinceCode: "75", name: "Nhơn Trạch" },

  // Bà Rịa - Vũng Tàu (77)
  { code: "747", provinceCode: "77", name: "Vũng Tàu" },
  { code: "748", provinceCode: "77", name: "Bà Rịa" },
  { code: "750", provinceCode: "77", name: "Phú Mỹ" },

  // Thừa Thiên Huế (46)
  { code: "474", provinceCode: "46", name: "TP. Huế" },
  { code: "476", provinceCode: "46", name: "Hương Thủy" },
  { code: "477", provinceCode: "46", name: "Hương Trà" },

  // Quảng Ninh (22)
  { code: "193", provinceCode: "22", name: "Hạ Long" },
  { code: "194", provinceCode: "22", name: "Móng Cái" },
  { code: "195", provinceCode: "22", name: "Cẩm Phả" },
  { code: "196", provinceCode: "22", name: "Uông Bí" },

  // Bắc Ninh (27)
  { code: "256", provinceCode: "27", name: "Bắc Ninh" },
  { code: "258", provinceCode: "27", name: "Từ Sơn" },
  { code: "262", provinceCode: "27", name: "Thuận Thành" },

  // Khánh Hòa (56)
  { code: "568", provinceCode: "56", name: "Nha Trang" },
  { code: "569", provinceCode: "56", name: "Cam Ranh" },
  { code: "570", provinceCode: "56", name: "Ninh Hòa" },

  // Lâm Đồng (68)
  { code: "672", provinceCode: "68", name: "Đà Lạt" },
  { code: "673", provinceCode: "68", name: "Bảo Lộc" },

  // Các tỉnh khác - bổ sung huyện/thành phố trung tâm chuẩn
  ...VIETNAM_PROVINCES.filter(
    (p) =>
      ![
        "01",
        "79",
        "31",
        "48",
        "91",
        "74",
        "75",
        "77",
        "46",
        "22",
        "27",
        "56",
        "68",
      ].includes(p.code),
  ).flatMap((p) => [
    {
      code: `${p.code}1`,
      provinceCode: p.code,
      name: `TP. ${p.name.replace(/^(TP\.\s*|Tỉnh\s*)/, "")}`,
    },
    { code: `${p.code}2`, provinceCode: p.code, name: `Huyện Trung Tâm` },
  ]),
];

export const VIETNAM_WARDS: AdministrativeWard[] = [
  // Ba Đình (001)
  { code: "00001", districtCode: "001", name: "Phường Phúc Xá" },
  { code: "00004", districtCode: "001", name: "Phường Trúc Bạch" },
  { code: "00006", districtCode: "001", name: "Phường Vĩnh Phúc" },
  { code: "00007", districtCode: "001", name: "Phường Cống Vị" },
  { code: "00008", districtCode: "001", name: "Phường Liễu Giai" },
  { code: "00010", districtCode: "001", name: "Phường Quán Thánh" },
  { code: "00013", districtCode: "001", name: "Phường Điện Biên" },
  { code: "00016", districtCode: "001", name: "Phường Đội Cấn" },
  { code: "00019", districtCode: "001", name: "Phường Ngọc Khánh" },
  { code: "00022", districtCode: "001", name: "Phường Kim Mã" },
  { code: "00025", districtCode: "001", name: "Phường Giảng Võ" },
  { code: "00028", districtCode: "001", name: "Phường Thành Công" },

  // Cầu Giấy (005)
  { code: "00157", districtCode: "005", name: "Phường Nghĩa Đô" },
  { code: "00160", districtCode: "005", name: "Phường Nghĩa Tân" },
  { code: "00163", districtCode: "005", name: "Phường Mai Dịch" },
  { code: "00166", districtCode: "005", name: "Phường Dịch Vọng" },
  { code: "00167", districtCode: "005", name: "Phường Dịch Vọng Hậu" },
  { code: "00169", districtCode: "005", name: "Phường Quan Hoa" },
  { code: "00172", districtCode: "005", name: "Phường Yên Hòa" },
  { code: "00175", districtCode: "005", name: "Phường Trung Hòa" },

  // Quận 1 (760)
  { code: "26734", districtCode: "760", name: "Phường Bến Nghé" },
  { code: "26740", districtCode: "760", name: "Phường Bến Thành" },
  { code: "26743", districtCode: "760", name: "Phường Cầu Kho" },
  { code: "26746", districtCode: "760", name: "Phường Cầu Ông Lãnh" },
  { code: "26749", districtCode: "760", name: "Phường Cô Giang" },
  { code: "26752", districtCode: "760", name: "Phường Đa Kao" },
  { code: "26755", districtCode: "760", name: "Phường Nguyễn Cư Trinh" },
  { code: "26758", districtCode: "760", name: "Phường Nguyễn Thái Bình" },
  { code: "26761", districtCode: "760", name: "Phường Phạm Ngũ Lão" },
  { code: "26764", districtCode: "760", name: "Phường Tân Định" },

  // Quận 3 (770)
  { code: "27139", districtCode: "770", name: "Phường Võ Thị Sáu" },
  { code: "27142", districtCode: "770", name: "Phường 1" },
  { code: "27145", districtCode: "770", name: "Phường 2" },
  { code: "27148", districtCode: "770", name: "Phường 3" },
  { code: "27151", districtCode: "770", name: "Phường 4" },
  { code: "27154", districtCode: "770", name: "Phường 5" },
  { code: "27160", districtCode: "770", name: "Phường 9" },
  { code: "27166", districtCode: "770", name: "Phường 11" },

  // Bình Thạnh (765)
  { code: "26920", districtCode: "765", name: "Phường 1" },
  { code: "26923", districtCode: "765", name: "Phường 2" },
  { code: "26926", districtCode: "765", name: "Phường 3" },
  { code: "26941", districtCode: "765", name: "Phường 14" },
  { code: "26947", districtCode: "765", name: "Phường 25" },

  // Hải Châu - Đà Nẵng (490)
  { code: "20227", districtCode: "490", name: "Phường Hải Châu 1" },
  { code: "20230", districtCode: "490", name: "Phường Hải Châu 2" },
  { code: "20233", districtCode: "490", name: "Phường Thạch Thang" },
  { code: "20236", districtCode: "490", name: "Phường Thanh Bình" },

  // Cung cấp các phường mặc định cho các quận còn lại
  ...VIETNAM_DISTRICTS.filter(
    (d) => !["001", "005", "760", "770", "765", "490"].includes(d.code),
  ).flatMap((d) => [
    { code: `${d.code}01`, districtCode: d.code, name: "Phường 1" },
    { code: `${d.code}02`, districtCode: d.code, name: "Phường 2" },
    { code: `${d.code}03`, districtCode: d.code, name: "Phường Trung Tâm" },
  ]),
];

export function getProvinces(): AdministrativeProvince[] {
  return VIETNAM_PROVINCES;
}

export function getDistricts(provinceCode: string): AdministrativeDistrict[] {
  if (!provinceCode) return [];
  return VIETNAM_DISTRICTS.filter((d) => d.provinceCode === provinceCode);
}

export function getWards(districtCode: string): AdministrativeWard[] {
  if (!districtCode) return [];
  return VIETNAM_WARDS.filter((w) => w.districtCode === districtCode);
}

export function findProvinceByCode(
  code: string,
): AdministrativeProvince | undefined {
  return VIETNAM_PROVINCES.find((p) => p.code === code);
}

export function findDistrictByCode(
  districtCode: string,
  provinceCode?: string,
): AdministrativeDistrict | undefined {
  return VIETNAM_DISTRICTS.find(
    (d) =>
      d.code === districtCode &&
      (!provinceCode || d.provinceCode === provinceCode),
  );
}

export function findWardByCode(
  wardCode: string,
  districtCode?: string,
): AdministrativeWard | undefined {
  return VIETNAM_WARDS.find(
    (w) =>
      w.code === wardCode && (!districtCode || w.districtCode === districtCode),
  );
}

function normalizeAdminName(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /^(tỉnh|thành phố|tp\.|quận|huyện|thị xã|phường|xã|thị trấn)\s+/gi,
      "",
    )
    .trim();
}

export interface AddressValidationInput {
  provinceCode?: string;
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
  const {
    provinceCode,
    districtCode,
    wardCode,
    provinceName,
    districtName,
    wardName,
  } = input;

  if (provinceCode) {
    const province = findProvinceByCode(provinceCode);
    if (!province) {
      return { valid: false, error: "Mã tỉnh/thành phố không tồn tại" };
    }
    if (provinceName) {
      const normInput = normalizeAdminName(provinceName);
      const normKnown = normalizeAdminName(province.name);
      if (
        normInput !== normKnown &&
        !normKnown.includes(normInput) &&
        !normInput.includes(normKnown)
      ) {
        return {
          valid: false,
          error: `tên tỉnh "${provinceName}" không khớp với mã "${provinceCode}" (${province.name})`,
        };
      }
    }
  }

  if (districtCode) {
    if (!provinceCode) {
      return {
        valid: false,
        error: "Không thể chỉ định quận/huyện mà không có mã tỉnh/thành phố",
      };
    }
    const district = findDistrictByCode(districtCode, provinceCode);
    if (!district) {
      return {
        valid: false,
        error: `Mã quận/huyện "${districtCode}" không tồn tại hoặc không thuộc tỉnh "${provinceCode}"`,
      };
    }
    if (districtName) {
      const normInput = normalizeAdminName(districtName);
      const normKnown = normalizeAdminName(district.name);
      if (
        normInput !== normKnown &&
        !normKnown.includes(normInput) &&
        !normInput.includes(normKnown)
      ) {
        return {
          valid: false,
          error: `Tên quận/huyện "${districtName}" không khớp với mã "${districtCode}"`,
        };
      }
    }
  }

  if (wardCode) {
    if (!districtCode) {
      return {
        valid: false,
        error: "Không thể chỉ định phường/xã mà không có mã quận/huyện",
      };
    }
    const ward = findWardByCode(wardCode, districtCode);
    if (!ward) {
      return {
        valid: false,
        error: `Mã phường/xã "${wardCode}" không tồn tại hoặc không thuộc quận/huyện "${districtCode}"`,
      };
    }
    if (wardName) {
      const normInput = normalizeAdminName(wardName);
      const normKnown = normalizeAdminName(ward.name);
      if (
        normInput !== normKnown &&
        !normKnown.includes(normInput) &&
        !normInput.includes(normKnown)
      ) {
        return {
          valid: false,
          error: `Tên phường/xã "${wardName}" không khớp với mã "${wardCode}"`,
        };
      }
    }
  }

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

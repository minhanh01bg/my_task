import { crc16CcittFalse } from "./crc";
import type { VietQrInput } from "./types";

/**
 * Moi truong EMVCo co dang: <id 2 ky tu><do dai 2 chu so><noi dung>.
 * Do dai phai tu tinh nen khong the hardcode chuoi.
 */
function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

const GUID_VIETQR = "A000000727";
const SERVICE_TRANSFER = "QRIBFTTA";
const CURRENCY_VND = "704";
const COUNTRY_VN = "VN";

/**
 * Dung payload VietQR ngay TRONG MAY theo chuan EMVCo — khong goi API ben ngoai.
 * Nho vay mat mang van hien duoc QR va khach van chuyen khoan duoc.
 */
export function buildVietQrPayload(input: VietQrInput): string {
  const accountInfo =
    field("00", input.account.bankBin) +
    field("01", input.account.accountNumber);

  const merchantAccount =
    field("00", GUID_VIETQR) +
    field("01", accountInfo) +
    field("02", SERVICE_TRANSFER);

  let payload =
    field("00", "01") +
    field("01", "12") +
    field("38", merchantAccount) +
    field("53", CURRENCY_VND);

  if (input.amount > 0) {
    payload += field("54", String(Math.round(input.amount)));
  }

  payload += field("58", COUNTRY_VN);

  if (input.description) {
    payload += field("62", field("08", input.description));
  }

  payload += "6304";

  return payload + crc16CcittFalse(payload);
}

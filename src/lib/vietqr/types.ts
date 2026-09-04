export interface BankAccount {
  /** Ma BIN 6 chu so cua ngan hang, VD "970423" (TPBank). */
  bankBin: string;
  accountNumber: string;
  accountName: string;
}

export interface VietQrInput {
  account: BankAccount;
  /** So nguyen VND. Bang 0 nghia la QR tinh — khach tu nhap so tien. */
  amount: number;
  /** Noi dung chuyen khoan — dung ma don, VD "DH1042". */
  description: string;
}

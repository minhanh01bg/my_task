import type { Prisma } from "@prisma/client";

import type { BankAccount } from "@/lib/vietqr/types";

const BANK_FIELDS = ["bankBin", "accountNumber", "accountName"] as const;

/** Bat ky truong nao doi (ke ca lan cau hinh dau tien) deu la doi noi nhan tien. */
export function isBankAccountChanged(
  current: Partial<BankAccount>,
  next: BankAccount,
): boolean {
  return BANK_FIELDS.some((field) => current[field]?.trim() !== next[field]);
}

/** Chi giu 4 so cuoi, VD "****1234"; so qua ngan thi che het. */
export function maskAccountNumber(value: string | undefined): string {
  if (!value) return "(chưa có)";
  return value.length > 4 ? `****${value.slice(-4)}` : "****";
}

/** Bao chu cua hang moi lan doi tai khoan nhan tien; ghi cung transaction. */
export async function createBankAccountChangedNotification(
  tx: Pick<Prisma.TransactionClient, "adminNotification">,
  before: Partial<BankAccount>,
  after: BankAccount,
) {
  return tx.adminNotification.create({
    data: {
      eventKey: `bank-account:${crypto.randomUUID()}:changed`,
      kind: "bank_account_changed",
      title: "Tài khoản nhận tiền đã thay đổi",
      body: `Số tài khoản ${maskAccountNumber(before.accountNumber)} → ${maskAccountNumber(after.accountNumber)} · Ngân hàng ${after.bankBin}`,
      entityType: "store_settings",
      entityId: "store",
      href: "/admin/settings",
    },
  });
}

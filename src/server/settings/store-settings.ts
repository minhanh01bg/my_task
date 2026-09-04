import { prisma } from "@/server/db/prisma";
import type { BankAccount } from "@/lib/vietqr/types";

const KEY_BANK_BIN = "bank.bin";
const KEY_BANK_ACCOUNT = "bank.accountNumber";
const KEY_BANK_NAME = "bank.accountName";
const KEY_STORE_NAME = "store.name";

async function readSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/**
 * Tra ve null khi chua khai bao du ca ba truong — POS se hien
 * "chua cau hinh tai khoan" thay vi sinh QR sai.
 */
export async function getStoreBankAccount(): Promise<BankAccount | null> {
  const [bankBin, accountNumber, accountName] = await Promise.all([
    readSetting(KEY_BANK_BIN),
    readSetting(KEY_BANK_ACCOUNT),
    readSetting(KEY_BANK_NAME),
  ]);

  if (!bankBin || !accountNumber || !accountName) return null;

  return { bankBin, accountNumber, accountName };
}

export async function saveStoreBankAccount(
  account: BankAccount,
): Promise<void> {
  await Promise.all([
    writeSetting(KEY_BANK_BIN, account.bankBin),
    writeSetting(KEY_BANK_ACCOUNT, account.accountNumber),
    writeSetting(KEY_BANK_NAME, account.accountName),
  ]);
}

export async function getStoreName(): Promise<string> {
  return (await readSetting(KEY_STORE_NAME)) ?? "Cửa hàng";
}

export async function saveStoreName(name: string): Promise<void> {
  await writeSetting(KEY_STORE_NAME, name);
}

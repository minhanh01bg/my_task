import { prisma } from "@/server/db/prisma";
import type { BankAccount } from "@/lib/vietqr/types";
import {
  publicStoreProfileSchema,
  type PublicStoreProfile,
} from "@/types/storefront";

const KEY_BANK_BIN = "bank.bin";
const KEY_BANK_ACCOUNT = "bank.accountNumber";
const KEY_BANK_NAME = "bank.accountName";
const KEY_STORE_NAME = "store.name";
const KEY_STORE_HOTLINE = "store.hotline";
const KEY_STORE_ADDRESS = "store.address";
const KEY_STORE_OPENING_HOURS = "store.openingHours";
const KEY_STORE_MAP_URL = "store.mapUrl";

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

export async function getPublicStoreProfile(): Promise<PublicStoreProfile> {
  const [name, hotline, address, openingHours, mapUrl] = await Promise.all([
    readSetting(KEY_STORE_NAME),
    readSetting(KEY_STORE_HOTLINE),
    readSetting(KEY_STORE_ADDRESS),
    readSetting(KEY_STORE_OPENING_HOURS),
    readSetting(KEY_STORE_MAP_URL),
  ]);

  const raw = {
    name: name?.trim() || "Cửa hàng",
    hotline: hotline?.trim() || undefined,
    address: address?.trim() || undefined,
    openingHours: openingHours?.trim() || undefined,
    mapUrl:
      mapUrl?.trim() && mapUrl.trim().startsWith("https://")
        ? mapUrl.trim()
        : undefined,
  };

  return publicStoreProfileSchema.parse(raw);
}

export async function saveStoreProfile(
  profile: Partial<PublicStoreProfile>,
): Promise<void> {
  const writes: Promise<void>[] = [];

  if (profile.name !== undefined) {
    writes.push(writeSetting(KEY_STORE_NAME, profile.name));
  }
  if (profile.hotline !== undefined) {
    writes.push(writeSetting(KEY_STORE_HOTLINE, profile.hotline));
  }
  if (profile.address !== undefined) {
    writes.push(writeSetting(KEY_STORE_ADDRESS, profile.address));
  }
  if (profile.openingHours !== undefined) {
    writes.push(writeSetting(KEY_STORE_OPENING_HOURS, profile.openingHours));
  }
  if (profile.mapUrl !== undefined) {
    writes.push(writeSetting(KEY_STORE_MAP_URL, profile.mapUrl));
  }

  await Promise.all(writes);
}

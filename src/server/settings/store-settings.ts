import { cache } from "react";

import { resolveDefaultStoreName } from "@/config/store-name";
import type { BankAccount } from "@/lib/vietqr/types";
import { cachedPublic, revalidatePublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";
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

const PUBLIC_SETTING_KEYS = [
  KEY_STORE_NAME,
  KEY_STORE_HOTLINE,
  KEY_STORE_ADDRESS,
  KEY_STORE_OPENING_HOURS,
  KEY_STORE_MAP_URL,
] as const;

const BANK_SETTING_KEYS = [
  KEY_BANK_BIN,
  KEY_BANK_ACCOUNT,
  KEY_BANK_NAME,
] as const;

type SettingValues = Partial<Record<string, string>>;

/** Mot query cho ca nhom khoa — thay cho N lan findUnique. */
async function readSettings(keys: readonly string[]): Promise<SettingValues> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...keys] } },
    select: { key: true, value: true },
  });
  const values: SettingValues = {};
  for (const row of rows) {
    values[row.key] = row.value;
  }
  return values;
}

/**
 * Khoa cong khai (ten, hotline, dia chi...): dedupe trong request bang
 * React cache() va dung chung giua cac request qua Data Cache (tag settings).
 */
const loadPublicSettings = cache(
  (): Promise<SettingValues> =>
    cachedPublic(
      () => readSettings(PUBLIC_SETTING_KEYS),
      ["store-settings", "public"],
      // Rong → getPublicStoreProfile dung ten mac dinh tu env.
      { tags: [CACHE_TAGS.settings], revalidate: 300, fallback: () => ({}) },
    ),
);

/**
 * Tai khoan ngan hang CHI dedupe trong request, khong vao Data Cache: day la
 * thong tin nhan tien (VietQR) nen POS phai luon thay gia tri moi nhat, va
 * khong luu du lieu ngan hang vao cache dung chung.
 */
const loadBankSettings = cache(
  (): Promise<SettingValues> => readSettings(BANK_SETTING_KEYS),
);

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
  const settings = await loadBankSettings();
  const bankBin = settings[KEY_BANK_BIN];
  const accountNumber = settings[KEY_BANK_ACCOUNT];
  const accountName = settings[KEY_BANK_NAME];

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
  revalidatePublic(CACHE_TAGS.settings);
}

/** Đọc `process.env` lúc gọi (không cố định lúc import) — cùng thứ tự với `siteConfig.name`. */
function getDefaultStoreName(): string {
  return resolveDefaultStoreName({
    NEXT_PUBLIC_STORE_NAME: process.env.NEXT_PUBLIC_STORE_NAME,
    STORE_NAME: process.env.STORE_NAME,
  });
}

export async function getStoreName(): Promise<string> {
  const name = (await loadPublicSettings())[KEY_STORE_NAME];
  if (name && name.trim()) {
    return name.trim();
  }
  return getDefaultStoreName();
}

export async function saveStoreName(name: string): Promise<void> {
  await writeSetting(KEY_STORE_NAME, name);
  revalidatePublic(CACHE_TAGS.settings);
}

export async function getPublicStoreProfile(): Promise<PublicStoreProfile> {
  const settings = await loadPublicSettings();
  const name = settings[KEY_STORE_NAME];
  const hotline = settings[KEY_STORE_HOTLINE];
  const address = settings[KEY_STORE_ADDRESS];
  const openingHours = settings[KEY_STORE_OPENING_HOURS];
  const mapUrl = settings[KEY_STORE_MAP_URL];

  const raw = {
    name: name?.trim() || getDefaultStoreName(),
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

  if (writes.length === 0) return;

  await Promise.all(writes);
  revalidatePublic(CACHE_TAGS.settings);
}

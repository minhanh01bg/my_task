import { cache } from "react";
import type { Prisma } from "@prisma/client";

import {
  FALLBACK_STORE_NAME,
  resolveDefaultStoreName,
} from "@/config/store-name";
import {
  DEFAULT_SHIPPING_SETTINGS,
  type ShippingSettings,
} from "@/lib/shipping/shipping-fee";
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
const KEY_SHIPPING_FEE = "store.shippingFee";
const KEY_FREE_SHIPPING_THRESHOLD = "store.freeShippingThreshold";

const PUBLIC_SETTING_KEYS = [
  KEY_STORE_NAME,
  KEY_STORE_HOTLINE,
  KEY_STORE_ADDRESS,
  KEY_STORE_OPENING_HOURS,
  KEY_STORE_MAP_URL,
  KEY_SHIPPING_FEE,
  KEY_FREE_SHIPPING_THRESHOLD,
] as const;

const BANK_SETTING_KEYS = [
  KEY_BANK_BIN,
  KEY_BANK_ACCOUNT,
  KEY_BANK_NAME,
] as const;

type SettingValues = Partial<Record<string, string>>;
type SettingsClient = Pick<Prisma.TransactionClient, "setting">;

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

async function writeSetting(
  client: SettingsClient,
  key: string,
  value: string,
): Promise<void> {
  await client.setting.upsert({
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

/** Doc truc tiep tung truong dang luu (khong cache) de so sanh truoc khi ghi. */
export async function readStoreBankFields(): Promise<Partial<BankAccount>> {
  const settings = await readSettings(BANK_SETTING_KEYS);
  return {
    bankBin: settings[KEY_BANK_BIN],
    accountNumber: settings[KEY_BANK_ACCOUNT],
    accountName: settings[KEY_BANK_NAME],
  };
}

export async function saveStoreBankAccount(
  account: BankAccount,
  client: SettingsClient = prisma,
): Promise<void> {
  await writeSetting(client, KEY_BANK_BIN, account.bankBin);
  await writeSetting(client, KEY_BANK_ACCOUNT, account.accountNumber);
  await writeSetting(client, KEY_BANK_NAME, account.accountName);
  if (client === prisma) revalidatePublic(CACHE_TAGS.settings);
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
  await writeSetting(prisma, KEY_STORE_NAME, name);
  revalidatePublic(CACHE_TAGS.settings);
}

function storeProfileFromSettings(settings: SettingValues): PublicStoreProfile {
  return {
    name: settings[KEY_STORE_NAME] ?? getDefaultStoreName(),
    hotline: settings[KEY_STORE_HOTLINE],
    address: settings[KEY_STORE_ADDRESS],
    openingHours: settings[KEY_STORE_OPENING_HOURS],
    mapUrl: settings[KEY_STORE_MAP_URL],
  };
}

/** Đọc trực tiếp để admin sửa cả giá trị cũ không còn qua validation. */
export async function getAdminStoreProfile(): Promise<PublicStoreProfile> {
  return storeProfileFromSettings(await readSettings(PUBLIC_SETTING_KEYS));
}

export async function getPublicStoreProfile(): Promise<PublicStoreProfile> {
  const raw = storeProfileFromSettings(await loadPublicSettings());
  const { shape } = publicStoreProfileSchema;
  const name = shape.name.safeParse(raw.name);
  const defaultName = shape.name.safeParse(getDefaultStoreName());
  const profile: PublicStoreProfile = {
    name: name.success
      ? name.data
      : defaultName.success
        ? defaultName.data
        : FALLBACK_STORE_NAME,
  };

  // Một giá trị cũ sai không được làm mất các trường công khai còn hợp lệ.
  for (const field of [
    "hotline",
    "address",
    "openingHours",
    "mapUrl",
  ] as const) {
    const parsed = shape[field].safeParse(raw[field]?.trim() || undefined);
    if (parsed.success && parsed.data !== undefined) {
      profile[field] = parsed.data;
    }
  }
  return profile;
}

export async function saveStoreProfile(
  profile: Partial<PublicStoreProfile>,
  client: SettingsClient = prisma,
): Promise<void> {
  let changed = false;
  if (profile.name !== undefined) {
    await writeSetting(client, KEY_STORE_NAME, profile.name);
    changed = true;
  }
  if (profile.hotline !== undefined) {
    await writeSetting(client, KEY_STORE_HOTLINE, profile.hotline);
    changed = true;
  }
  if (profile.address !== undefined) {
    await writeSetting(client, KEY_STORE_ADDRESS, profile.address);
    changed = true;
  }
  if (profile.openingHours !== undefined) {
    await writeSetting(client, KEY_STORE_OPENING_HOURS, profile.openingHours);
    changed = true;
  }
  if (profile.mapUrl !== undefined) {
    await writeSetting(client, KEY_STORE_MAP_URL, profile.mapUrl);
    changed = true;
  }
  if (changed && client === prisma) revalidatePublic(CACHE_TAGS.settings);
}

/** Chuoi so nguyen VND >= 0; sai/thieu thi dung mac dinh. */
function parseMoneySetting(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return fallback;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

/**
 * Phi giao hang + nguong mien phi. Doc cung loader cong khai (mot query, tag
 * settings) — gio hang/checkout va duong ghi don dung chung mot nguon.
 */
export async function getShippingSettings(): Promise<ShippingSettings> {
  const settings = await loadPublicSettings();
  return {
    shippingFee: parseMoneySetting(
      settings[KEY_SHIPPING_FEE],
      DEFAULT_SHIPPING_SETTINGS.shippingFee,
    ),
    freeShippingThreshold: parseMoneySetting(
      settings[KEY_FREE_SHIPPING_THRESHOLD],
      DEFAULT_SHIPPING_SETTINGS.freeShippingThreshold,
    ),
  };
}

export async function saveShippingSettings(
  settings: ShippingSettings,
  client: SettingsClient = prisma,
): Promise<void> {
  await writeSetting(
    client,
    KEY_SHIPPING_FEE,
    String(Math.round(settings.shippingFee)),
  );
  await writeSetting(
    client,
    KEY_FREE_SHIPPING_THRESHOLD,
    String(Math.round(settings.freeShippingThreshold)),
  );
  if (client === prisma) revalidatePublic(CACHE_TAGS.settings);
}

import type { Prisma, Voucher } from "@prisma/client";

import {
  isVoucherType,
  normalizeVoucherCode,
  type VoucherRule,
} from "@/lib/vouchers/validate-voucher";
import { cachedPublic } from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";
import { prisma } from "@/server/db/prisma";

type VoucherRow = Pick<
  Voucher,
  | "code"
  | "type"
  | "value"
  | "maxDiscount"
  | "minOrderTotal"
  | "maxUses"
  | "usedCount"
  | "startsAt"
  | "endsAt"
  | "isActive"
>;

/** Bản ghi cache phải serialize được bằng JSON: Date -> ISO string. */
interface CachedVoucher extends Omit<VoucherRule, "startsAt" | "endsAt"> {
  startsAt: string | null;
  endsAt: string | null;
}

const voucherRuleSelect = {
  code: true,
  type: true,
  value: true,
  maxDiscount: true,
  minOrderTotal: true,
  maxUses: true,
  usedCount: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
} satisfies Prisma.VoucherSelect;

export function toVoucherRule(row: VoucherRow): VoucherRule | null {
  if (!isVoucherType(row.type)) return null;
  return { ...row, type: row.type };
}

/**
 * Đọc thẳng DB (không cache) — dùng cho đường ghi đơn để không bao giờ áp
 * voucher theo dữ liệu cũ. Truyền `tx` khi gọi trong `$transaction`.
 */
export async function findVoucherByCode(
  code: string,
  client: Prisma.TransactionClient = prisma,
): Promise<VoucherRule | null> {
  const normalized = normalizeVoucherCode(code);
  if (!normalized) return null;
  const row = await client.voucher.findUnique({
    where: { code: normalized },
    select: voucherRuleSelect,
  });
  return row ? toVoucherRule(row) : null;
}

/**
 * Voucher theo mã, cache theo tag `vouchers` (60s) — cho API kiểm tra mã.
 * `usedCount` trong cache có thể trễ; đơn hàng vẫn kiểm tra lại nguyên tử.
 */
export async function getVoucherByCode(
  code: string,
): Promise<VoucherRule | null> {
  const normalized = normalizeVoucherCode(code);
  if (!normalized) return null;

  const cached = await cachedPublic<CachedVoucher | null>(
    async () => {
      const rule = await findVoucherByCode(normalized);
      return rule
        ? {
            ...rule,
            startsAt: rule.startsAt?.toISOString() ?? null,
            endsAt: rule.endsAt?.toISOString() ?? null,
          }
        : null;
    },
    ["voucher-by-code", normalized],
    { tags: [CACHE_TAGS.vouchers], revalidate: 60 },
  );

  return cached
    ? {
        ...cached,
        startsAt: cached.startsAt ? new Date(cached.startsAt) : null,
        endsAt: cached.endsAt ? new Date(cached.endsAt) : null,
      }
    : null;
}

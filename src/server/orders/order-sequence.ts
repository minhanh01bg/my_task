import type { Prisma } from "@prisma/client";

export const ORDER_SEQUENCE_KEY = "order.sequence";

type SequenceRow = { seq: bigint | number };
type MaxSequenceRow = { maxSeq: bigint | number | null };

/**
 * Cap so thu tu don tiep theo tu hang `Setting` "order.sequence".
 *
 * Phai goi la CAU LENH DAU TIEN cua transaction: upsert la lenh ghi nen
 * SQLite cap khoa RESERVED ngay, cac transaction khac xep hang thay vi
 * cung doc roi tranh nhau nang cap khoa. Rollback transaction thi so cung
 * duoc tra lai.
 *
 * Lan dau (hang chua ton tai) upsert chen "1"; neu DB da co don thi seed lai
 * tu so lon nhat trong cac ma `DH<so>` hien co + 1 de khong dung ma cu.
 */
export async function nextOrderSequence(
  tx: Prisma.TransactionClient,
): Promise<number> {
  const [row] = await tx.$queryRaw<SequenceRow[]>`
    INSERT INTO "Setting"("key", "value") VALUES (${ORDER_SEQUENCE_KEY}, '1')
    ON CONFLICT("key") DO UPDATE
      SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
    RETURNING CAST("value" AS INTEGER) AS seq
  `;
  const sequence = Number(row?.seq);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error(`Bộ đếm mã đơn không hợp lệ: ${String(row?.seq)}`);
  }
  if (sequence > 1) return sequence;

  // Vua chen hang moi: seed tu ma don lon nhat da ton tai.
  const [max] = await tx.$queryRaw<MaxSequenceRow[]>`
    SELECT MAX(CAST(SUBSTR("code", 3) AS INTEGER)) AS maxSeq
    FROM "Order"
    WHERE "code" LIKE 'DH%'
  `;
  const seeded = Number(max?.maxSeq ?? 0) + 1;
  if (seeded <= 1) return 1;

  await tx.$executeRaw`
    UPDATE "Setting" SET "value" = ${String(seeded)}
    WHERE "key" = ${ORDER_SEQUENCE_KEY}
  `;
  return seeded;
}

import { NextResponse } from "next/server";

import { errorLogFields, logger } from "@/lib/logger";
import { readJsonBody } from "@/server/http/read-json-body";
import { checkVoucherCode } from "@/server/vouchers/check-voucher-code";
import {
  checkVoucherRateLimit,
  VOUCHER_RATE_LIMIT_MESSAGE,
} from "@/server/vouchers/voucher-rate-limit";
import { voucherValidateRequestSchema } from "@/types/voucher";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const body = await readJsonBody(request, { maxBytes: 2_000 });
  if (!body.ok) {
    return NextResponse.json(
      { message: body.message },
      { status: body.status, headers: NO_STORE },
    );
  }

  const retryAfter = await checkVoucherRateLimit(request);
  if (retryAfter !== null) {
    return NextResponse.json(
      { message: VOUCHER_RATE_LIMIT_MESSAGE },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(retryAfter) },
      },
    );
  }

  const parsed = voucherValidateRequestSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ",
      },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const data = await checkVoucherCode(parsed.data.code, parsed.data.subtotal);
    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (error: unknown) {
    logger.error("voucher_validate_failed", {
      ...errorLogFields(error),
    });
    return NextResponse.json(
      { message: "Không kiểm tra được mã lúc này. Vui lòng thử lại." },
      { status: 500, headers: NO_STORE },
    );
  }
}

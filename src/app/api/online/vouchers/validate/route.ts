import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { readJsonBody } from "@/server/http/read-json-body";
import { checkVoucherCode } from "@/server/vouchers/check-voucher-code";
import { checkVoucherRateLimit } from "@/server/vouchers/voucher-rate-limit";
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
      { message: "Bạn thử mã quá nhiều lần. Vui lòng thử lại sau." },
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
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { message: "Không kiểm tra được mã lúc này. Vui lòng thử lại." },
      { status: 500, headers: NO_STORE },
    );
  }
}

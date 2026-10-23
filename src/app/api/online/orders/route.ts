import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { readJsonBody } from "@/server/http/read-json-body";
import {
  createOpaqueToken,
  digestOpaqueToken,
  readCustomerSessionToken,
  resolveCustomerSessionToken,
} from "@/server/customer-auth/session";
import {
  CHECKOUT_RECOVERY_COOKIE,
  createRecoverySecret,
} from "@/server/orders/checkout-idempotency";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { GUEST_CAPABILITY_LIFETIME_MS } from "@/server/orders/order-access";
import { OrderValidationError } from "@/server/orders/order-validation-error";
import { OnlineOrderError, onlineCheckoutSchema } from "@/types/online-order";

import {
  checkPostParseAbuse,
  checkPreParseAbuse,
} from "@/server/security/checkout-abuse";
import {
  checkVoucherRateLimit,
  refundVoucherAttempt,
  VOUCHER_RATE_LIMIT_MESSAGE,
} from "@/server/vouchers/voucher-rate-limit";

/** A cookie that does not decode cannot be a secret we issued. */
function readCheckoutRecoverySecret(request: Request): string | null {
  const encoded = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)checkout_recovery=([^;]+)/)?.[1];
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  // Layer 1: Hard streamed body limit (64 KB cap & content-type check)
  const bodyResult = await readJsonBody(request, { maxBytes: 64_000 });
  if (!bodyResult.ok) {
    return NextResponse.json(
      { message: bodyResult.message },
      {
        status: bodyResult.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 2: Cheap pre-parse IP/subnet/global burst anti-abuse check
  const preCheck = await checkPreParseAbuse(request);
  if (!preCheck.ok) {
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (preCheck.retryAfterSeconds) {
      headers["Retry-After"] = String(preCheck.retryAfterSeconds);
    }
    return NextResponse.json(
      { message: preCheck.message },
      { status: preCheck.status, headers },
    );
  }

  const parsed = onlineCheckoutSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    // Gio hang chi chan theo ton kho: noi ro tran so luong de khach sua duoc.
    const quantityIssue = parsed.error.issues.find(
      (issue) => issue.code === "too_big" && issue.path.at(-1) === "quantity",
    );
    return NextResponse.json(
      {
        message: quantityIssue?.message ?? "Thông tin đặt hàng không hợp lệ",
        issues: parsed.error.issues,
      },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 3: Post-parse velocity anti-abuse check on phone and product IDs
  const postCheck = await checkPostParseAbuse(parsed.data, request);
  if (!postCheck.ok) {
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (postCheck.retryAfterSeconds) {
      headers["Retry-After"] = String(postCheck.retryAfterSeconds);
    }
    return NextResponse.json(
      { message: postCheck.message },
      { status: postCheck.status, headers },
    );
  }

  // Layer 4: checkout dung chung han muc do ma voi /api/online/vouchers/validate.
  // Tinh truoc mot luot, hoan lai neu voucher khong bi tu choi: chi ma sai
  // moi bi tru, va het han muc thi ca ma dung cung nhan 429 (khong lo ma nao dung).
  const chargesVoucher = Boolean(parsed.data.voucherCode);
  if (chargesVoucher) {
    const retryAfter = await checkVoucherRateLimit(request);
    if (retryAfter !== null) {
      return NextResponse.json(
        { message: VOUCHER_RATE_LIMIT_MESSAGE },
        {
          status: 429,
          headers: {
            "Cache-Control": "private, no-store",
            "Retry-After": String(retryAfter),
          },
        },
      );
    }
  }
  let voucherRejected = false;

  try {
    const session = await resolveCustomerSessionToken(
      readCustomerSessionToken(request),
    );

    let recoverySecret = readCheckoutRecoverySecret(request);
    let isNewRecoverySecret = false;
    if (!recoverySecret && !session) {
      recoverySecret = createRecoverySecret();
      isNewRecoverySecret = true;
    }

    const guestToken = session ? null : createOpaqueToken();
    const result = await createOnlineOrder(parsed.data, {
      customerAccountId: session?.accountId,
      guestAccess: guestToken
        ? {
            tokenHash: digestOpaqueToken(guestToken),
            expiresAt: new Date(Date.now() + GUEST_CAPABILITY_LIFETIME_MS),
          }
        : undefined,
      guestRecovery:
        !session && recoverySecret
          ? {
              secret: recoverySecret,
              guestToken: guestToken ?? undefined,
            }
          : undefined,
    });

    const effectiveGuestToken = result.duplicated
      ? result.recoveredGuestToken
      : (guestToken ?? undefined);

    const accessUrl = session
      ? `/account/orders/${result.order.id}`
      : effectiveGuestToken
        ? `/orders/guest/${effectiveGuestToken}`
        : undefined;

    const receiptUrl = result.receiptNonce
      ? `/order-success/${result.receiptNonce}`
      : undefined;

    const response = NextResponse.json(
      {
        data: {
          order: {
            code: result.order.code,
            total: result.order.total,
            status: result.order.status,
            fulfillmentStatus: "new",
            accessUrl,
            receiptUrl,
          },
          duplicated: result.duplicated,
        },
      },
      {
        status: result.duplicated ? 200 : 201,
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );

    if (isNewRecoverySecret && recoverySecret) {
      const isProduction = process.env.NODE_ENV === "production";
      response.cookies.set({
        name: CHECKOUT_RECOVERY_COOKIE,
        value: recoverySecret,
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        path: "/",
        maxAge: 1800,
      });
    }

    return response;
  } catch (error) {
    if (error instanceof OnlineOrderError) {
      voucherRejected = error.code === "VOUCHER_INVALID";
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          productIds: error.productIds,
        },
        {
          status: 409,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    // An order too large for the Int columns is a business rejection, not a
    // server failure; other OrderValidationError codes stay 500 (server bug).
    if (
      error instanceof OrderValidationError &&
      error.code === "AMOUNT_TOO_LARGE"
    ) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        {
          status: 409,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    }
    const correlationId = crypto.randomUUID();
    const errorClass =
      error instanceof Error ? error.constructor.name : typeof error;
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code: unknown }).code)
        : "INTERNAL_ERROR";

    // No error.message: Prisma messages can echo customer phone/name values.
    logger.error("online_order_create_failed", {
      correlationId,
      errorClass,
      errorCode,
    });
    return NextResponse.json(
      {
        message: "Không thể tạo đơn lúc này. Vui lòng thử lại.",
        correlationId,
      },
      {
        status: 500,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } finally {
    if (chargesVoucher && !voucherRejected) {
      await refundVoucherAttempt(request);
    }
  }
}

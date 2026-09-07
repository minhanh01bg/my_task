import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { readJsonBody } from "@/server/http/read-json-body";
import {
  createOpaqueToken,
  digestOpaqueToken,
  resolveCustomerSessionToken,
} from "@/server/customer-auth/session";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { OnlineOrderError, onlineCheckoutSchema } from "@/types/online-order";

import {
  checkPostParseAbuse,
  checkPreParseAbuse,
} from "@/server/security/checkout-abuse";

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
    return NextResponse.json(
      {
        message: "Thông tin đặt hàng không hợp lệ",
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

  try {
    const customerToken = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)customer_session=([^;]+)/)?.[1];
    const session = await resolveCustomerSessionToken(
      customerToken ? decodeURIComponent(customerToken) : null,
    );
    const guestToken = session ? null : createOpaqueToken();
    const result = await createOnlineOrder(parsed.data, {
      customerAccountId: session?.accountId,
      guestAccess: guestToken
        ? {
            tokenHash: digestOpaqueToken(guestToken),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          }
        : undefined,
    });
    return NextResponse.json(
      {
        data: {
          order: {
            code: result.order.code,
            total: result.order.total,
            status: result.order.status,
            fulfillmentStatus: "new",
            accessUrl: session
              ? `/account/orders/${result.order.id}`
              : guestToken && !result.duplicated
                ? `/orders/guest/${guestToken}`
                : undefined,
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
  } catch (error) {
    if (error instanceof OnlineOrderError) {
      return NextResponse.json(
        {
          code: error.code,
          message: error.message,
          productIds: error.productIds,
        },
        { status: 409 },
      );
    }
    logger.error("online_order_create_failed", { error });
    return NextResponse.json(
      { message: "Không thể tạo đơn lúc này. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}

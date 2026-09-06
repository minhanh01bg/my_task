import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import {
  createOpaqueToken,
  digestOpaqueToken,
  resolveCustomerSessionToken,
} from "@/server/customer-auth/session";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { OnlineOrderError, onlineCheckoutSchema } from "@/types/online-order";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 64_000) {
    return NextResponse.json({ message: "Dữ liệu quá lớn" }, { status: 413 });
  }
  const parsed = onlineCheckoutSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Thông tin đặt hàng không hợp lệ",
        issues: parsed.error.issues,
      },
      { status: 400 },
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

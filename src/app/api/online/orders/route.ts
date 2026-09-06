import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
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
    const result = await createOnlineOrder(parsed.data);
    return NextResponse.json(
      {
        data: {
          order: {
            code: result.order.code,
            total: result.order.total,
            status: result.order.status,
            fulfillmentStatus: "new",
          },
          duplicated: result.duplicated,
        },
      },
      { status: result.duplicated ? 200 : 201 },
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

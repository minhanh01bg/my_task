import { NextResponse } from "next/server";

import { errorLogFields, logger } from "@/lib/logger";
import { checkBackInStockRateLimit } from "@/server/back-in-stock/back-in-stock-rate-limit";
import {
  isSubscribedBackInStock,
  subscribeBackInStock,
  unsubscribeBackInStock,
  type BackInStockFailureCode,
} from "@/server/back-in-stock/subscriptions";
import {
  readCustomerSessionToken,
  resolveCustomerSessionToken,
} from "@/server/customer-auth/session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import {
  backInStockProductIdSchema,
  backInStockUpdateSchema,
  type BackInStockState,
} from "@/types/back-in-stock";

const NO_STORE = { "Cache-Control": "private, no-store" };
const UNAUTHORIZED_MESSAGE = "Vui lòng đăng nhập để nhận thông báo khi có hàng";
const INVALID_MESSAGE = "Dữ liệu không hợp lệ";

const FAILURES = {
  product_not_found: { status: 404, message: "Không tìm thấy sản phẩm" },
  product_in_stock: {
    status: 409,
    message: "Sản phẩm đã có hàng trở lại, bạn có thể đặt mua ngay",
  },
  too_many_subscriptions: {
    status: 409,
    message:
      "Bạn đang chờ quá nhiều sản phẩm. Hãy bỏ bớt trước khi đăng ký thêm",
  },
} satisfies Record<BackInStockFailureCode, { status: number; message: string }>;

function message(text: string, status: number) {
  return NextResponse.json({ message: text }, { status, headers: NO_STORE });
}

function state(body: BackInStockState) {
  return NextResponse.json(body, { headers: NO_STORE });
}

function unexpectedError(
  event: string,
  text: string,
  fields: Record<string, unknown>,
) {
  const correlationId = crypto.randomUUID();
  logger.error(event, { correlationId, ...fields });
  return NextResponse.json(
    { message: text, correlationId },
    { status: 500, headers: NO_STORE },
  );
}

/** Trang san pham la trang tinh: nut "Bao khi co hang" hoi trang thai o day. */
export async function GET(request: Request) {
  const session = await resolveCustomerSessionToken(
    readCustomerSessionToken(request),
  );
  if (!session) return message(UNAUTHORIZED_MESSAGE, 401);

  const productId = backInStockProductIdSchema.safeParse(
    new URL(request.url).searchParams.get("productId"),
  );
  if (!productId.success) return message(INVALID_MESSAGE, 400);

  try {
    const subscribed = await isSubscribedBackInStock(
      session.accountId,
      productId.data,
    );
    return state({ productId: productId.data, subscribed });
  } catch (error: unknown) {
    return unexpectedError(
      "back_in_stock_state_failed",
      "Không tải được trạng thái. Vui lòng thử lại.",
      { productId: productId.data, ...errorLogFields(error) },
    );
  }
}

/** Dat trang thai mong muon (`subscribed`), nen gui lap lai vo hai. */
export async function POST(request: Request) {
  if (!hasSafeMutationOrigin(request)) {
    return message("Nguồn gốc yêu cầu không hợp lệ", 403);
  }

  const session = await resolveCustomerSessionToken(
    readCustomerSessionToken(request),
  );
  if (!session) return message(UNAUTHORIZED_MESSAGE, 401);

  const body = await readJsonBody(request, { maxBytes: 1_000 });
  if (!body.ok) return message(body.message, body.status);

  const parsed = backInStockUpdateSchema.safeParse(body.data);
  if (!parsed.success) return message(INVALID_MESSAGE, 400);

  const retryAfter = await checkBackInStockRateLimit(
    request,
    session.accountId,
  );
  if (retryAfter !== null) {
    return NextResponse.json(
      { message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau." },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(retryAfter) },
      },
    );
  }

  const { productId, subscribed } = parsed.data;
  try {
    const result = subscribed
      ? await subscribeBackInStock(session.accountId, productId)
      : await unsubscribeBackInStock(session.accountId, productId);
    if (!result.ok) {
      const failure = FAILURES[result.code];
      return NextResponse.json(
        { code: result.code, message: failure.message },
        { status: failure.status, headers: NO_STORE },
      );
    }
    return state({ productId, subscribed });
  } catch (error: unknown) {
    return unexpectedError(
      "back_in_stock_update_failed",
      "Không cập nhật được đăng ký. Vui lòng thử lại.",
      { productId, ...errorLogFields(error) },
    );
  }
}

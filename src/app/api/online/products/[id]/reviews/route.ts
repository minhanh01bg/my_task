import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { resolveCustomerSessionToken } from "@/server/customer-auth/session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import { createReview } from "@/server/reviews/create-review";
import { listProductReviews } from "@/server/reviews/list-reviews";
import { checkReviewRateLimit } from "@/server/reviews/review-rate-limit";
import { createReviewInputSchema } from "@/types/review";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** `page` sai kieu → 400 thay vi am tham ve trang 1 (client luon gui so nguyen). */
const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

type RouteContext = { params: Promise<{ id: string }> };

function readSessionCookie(request: Request): string | null {
  const raw = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)customer_session=([^;]+)/)?.[1];
  return raw ? decodeURIComponent(raw) : null;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const query = pageQuerySchema.safeParse({
    page: new URL(request.url).searchParams.get("page") ?? undefined,
  });
  if (!query.success) {
    return NextResponse.json(
      { message: "Trang đánh giá không hợp lệ" },
      { status: 400, headers: NO_STORE },
    );
  }
  const data = await listProductReviews(id, query.data.page);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=30" },
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;

  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { message: "Nguồn gốc yêu cầu không hợp lệ" },
      { status: 403, headers: NO_STORE },
    );
  }

  const session = await resolveCustomerSessionToken(readSessionCookie(request));
  if (!session) {
    return NextResponse.json(
      { message: "Vui lòng đăng nhập để gửi đánh giá" },
      { status: 401, headers: NO_STORE },
    );
  }

  const body = await readJsonBody(request, { maxBytes: 8_000 });
  if (!body.ok) {
    return NextResponse.json(
      { message: body.message },
      { status: body.status, headers: NO_STORE },
    );
  }

  const parsed = createReviewInputSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Đánh giá không hợp lệ" },
      { status: 400, headers: NO_STORE },
    );
  }

  const retryAfter = await checkReviewRateLimit(request, session.accountId);
  if (retryAfter !== null) {
    return NextResponse.json(
      { message: "Bạn đã gửi quá nhiều đánh giá. Vui lòng thử lại sau." },
      {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(retryAfter) },
      },
    );
  }

  try {
    const result = await createReview({
      productId: id,
      accountId: session.accountId,
      input: parsed.data,
    });
    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        {
          status: result.reason === "not_found" ? 404 : 400,
          headers: NO_STORE,
        },
      );
    }
    return NextResponse.json(
      {
        review: result.review,
        summary: result.summary,
        updated: result.updated,
      },
      { status: result.updated ? 200 : 201, headers: NO_STORE },
    );
  } catch (error: unknown) {
    logger.error("product_review_create_failed", {
      productId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { message: "Không gửi được đánh giá lúc này. Vui lòng thử lại." },
      { status: 500, headers: NO_STORE },
    );
  }
}

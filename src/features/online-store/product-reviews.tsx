"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  LogIn,
  MessageSquarePlus,
  MessagesSquare,
} from "lucide-react";

import { EmptyState } from "@/components/kit/empty-state";
import { StarRating } from "@/components/kit/star-rating";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  REVIEW_CONTENT_MAX,
  REVIEW_CONTENT_MIN,
  type PublicReview,
  type PublicReviewPage,
  type RatingSummary,
} from "@/types/review";

import { useStorefrontSession } from "./session-aware-actions";

export interface ProductReviewsProps {
  productId: string;
  productName: string;
  /** Trang 1 đánh giá đã đăng, đọc sẵn phía server. */
  initialReviews: PublicReviewPage;
  /** Tổng hợp từ `Product.ratingAvg/ratingCount`. */
  summary: RatingSummary;
}

const reviewDateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "medium",
});

function reviewsEndpoint(productId: string): string {
  return `/api/online/products/${encodeURIComponent(productId)}/reviews`;
}

async function readMessage(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      return body.message;
    }
  } catch {
    // Body không phải JSON — dùng thông báo mặc định.
  }
  return fallback;
}

function isReviewResponse(
  body: unknown,
): body is { review: PublicReview; summary: RatingSummary } {
  return (
    typeof body === "object" &&
    body !== null &&
    "review" in body &&
    "summary" in body
  );
}

function isReviewPage(body: unknown): body is PublicReviewPage {
  return (
    typeof body === "object" &&
    body !== null &&
    "items" in body &&
    Array.isArray(body.items)
  );
}

export function ProductReviews({
  productId,
  productName,
  initialReviews,
  summary: initialSummary,
}: ProductReviewsProps) {
  const session = useStorefrontSession();
  const [reviews, setReviews] = useState<PublicReview[]>(initialReviews.items);
  const [total, setTotal] = useState(initialReviews.total);
  const [page, setPage] = useState(initialReviews.page);
  const [summary, setSummary] = useState<RatingSummary>(initialSummary);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const hasMore = reviews.length < total;
  const trimmedLength = content.trim().length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (trimmedLength < REVIEW_CONTENT_MIN) {
      setFormError(`Nội dung đánh giá cần ít nhất ${REVIEW_CONTENT_MIN} ký tự`);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch(reviewsEndpoint(productId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ rating, content: content.trim() }),
      });
      if (!response.ok) {
        setFormError(
          await readMessage(
            response,
            response.status === 401
              ? "Vui lòng đăng nhập để gửi đánh giá"
              : "Không gửi được đánh giá. Vui lòng thử lại.",
          ),
        );
        return;
      }
      const body: unknown = await response.json();
      if (!isReviewResponse(body)) {
        setFormError("Không gửi được đánh giá. Vui lòng thử lại.");
        return;
      }
      setReviews((prev) => [body.review, ...prev]);
      setTotal((prev) => prev + 1);
      setSummary(body.summary);
      setContent("");
      setRating(5);
      setShowForm(false);
      setSubmitted(true);
    } catch {
      setFormError("Mất kết nối. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `${reviewsEndpoint(productId)}?page=${page + 1}`,
        { headers: { Accept: "application/json" } },
      );
      const body: unknown = response.ok ? await response.json() : null;
      if (!isReviewPage(body)) {
        setLoadError("Không tải được thêm đánh giá.");
        return;
      }
      setReviews((prev) => {
        const seen = new Set(prev.map((review) => review.id));
        return [...prev, ...body.items.filter((item) => !seen.has(item.id))];
      });
      setTotal(body.total);
      setPage(body.page);
    } catch {
      setLoadError("Không tải được thêm đánh giá.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      id="product-reviews"
      aria-labelledby="product-reviews-heading"
      className="surface-panel mt-10 scroll-mt-24 rounded-2xl border p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <h2 id="product-reviews-heading" className="text-2xl font-bold">
            Đánh giá từ khách hàng
          </h2>
          <div className="mt-2">
            {summary.count > 0 ? (
              <StarRating
                rating={summary.avg}
                reviewCount={summary.count}
                size="md"
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Chưa có đánh giá nào cho {productName}.
              </p>
            )}
          </div>
        </div>

        {session.isCustomer ? (
          <Button
            type="button"
            onClick={() => {
              setShowForm((open) => !open);
              setFormError(null);
            }}
            aria-expanded={showForm}
            className="min-h-11 gap-2 rounded-xl font-bold"
          >
            <MessageSquarePlus className="size-4" aria-hidden="true" />
            <span>{showForm ? "Đóng form" : "Viết đánh giá"}</span>
          </Button>
        ) : (
          <Link
            href="/account/login"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "min-h-11 gap-2 rounded-xl font-bold",
            )}
          >
            <LogIn className="size-4" aria-hidden="true" />
            <span>Đăng nhập để viết đánh giá</span>
          </Link>
        )}
      </div>

      {submitted ? (
        <p
          role="status"
          className="border-success/20 bg-success/10 text-success mt-4 flex items-center gap-2 rounded-xl border p-3.5 text-sm"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          <span>Cảm ơn bạn đã gửi đánh giá!</span>
        </p>
      ) : null}

      {showForm && session.isCustomer ? (
        <form
          onSubmit={handleSubmit}
          className="bg-muted/40 mt-6 space-y-4 rounded-2xl border p-5"
          noValidate
        >
          <h3 className="text-base font-bold">
            Chia sẻ cảm nhận của bạn về sản phẩm
          </h3>

          <div>
            <p className="text-muted-foreground mb-1.5 text-xs font-semibold tracking-wider uppercase">
              Chấm điểm sản phẩm
            </p>
            <StarRating
              rating={rating}
              interactive
              size="lg"
              onChange={setRating}
              showLabel
            />
          </div>

          <div>
            <label
              htmlFor="review-content"
              className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wider uppercase"
            >
              Nội dung đánh giá
            </label>
            <textarea
              id="review-content"
              required
              rows={4}
              minLength={REVIEW_CONTENT_MIN}
              maxLength={REVIEW_CONTENT_MAX}
              placeholder="Chia sẻ cảm nhận chân thực về chất lượng, đóng gói, giao hàng..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
              aria-describedby="review-content-hint"
              className="border-input bg-background w-full rounded-xl border p-3 text-sm outline-none focus-visible:ring-2"
            />
            <p
              id="review-content-hint"
              className="text-muted-foreground mt-1 text-right text-xs"
            >
              {trimmedLength}/{REVIEW_CONTENT_MAX}
            </p>
          </div>

          {formError ? (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowForm(false)}
              className="min-h-11"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="min-h-11 font-bold"
            >
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </Button>
          </div>
        </form>
      ) : null}

      {reviews.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Chưa có đánh giá"
          description="Hãy là người đầu tiên chia sẻ cảm nhận về sản phẩm này."
          className="mt-6"
        />
      ) : (
        <ul className="mt-6 space-y-4 divide-y">
          {reviews.map((review) => (
            <li key={review.id} className="pt-4 first:pt-0">
              <article>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">
                      {review.authorName}
                    </span>
                    {review.isVerifiedPurchase ? (
                      <span className="bg-success/10 text-success inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.7rem] font-semibold">
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        <span>Đã mua hàng</span>
                      </span>
                    ) : null}
                  </div>
                  <time
                    dateTime={review.createdAt}
                    className="text-muted-foreground text-xs"
                  >
                    {reviewDateFormat.format(new Date(review.createdAt))}
                  </time>
                </div>
                <div className="mt-1.5">
                  <StarRating rating={review.rating} size="xs" />
                </div>
                <p className="text-foreground/90 mt-2 text-sm leading-relaxed whitespace-pre-line">
                  {review.content}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="min-h-11"
          >
            {loadingMore ? "Đang tải..." : "Xem thêm đánh giá"}
          </Button>
          {loadError ? (
            <p role="alert" className="text-destructive text-sm">
              {loadError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

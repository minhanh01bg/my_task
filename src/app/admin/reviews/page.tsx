import Link from "next/link";
import { CheckCircle2, MessagesSquare } from "lucide-react";

import { EmptyState, PageHeader, Pagination } from "@/components/kit";
import { StarRating } from "@/components/kit/star-rating";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { productHref } from "@/lib/seo/product-href";
import { cn } from "@/lib/utils";
import { parsePageParam } from "@/server/admin/pagination";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  ADMIN_REVIEWS_PAGE_SIZE,
  listAdminReviews,
} from "@/server/reviews/admin-reviews";
import { REVIEW_STATUSES, type ReviewStatus } from "@/types/review";

import { deleteReviewAction, setReviewStatusAction } from "./actions";

export const dynamic = "force-dynamic";

const PATH = "/admin/reviews";

const STATUS_FILTERS: Array<{ value: ReviewStatus | null; label: string }> = [
  { value: null, label: "Tất cả" },
  { value: "published", label: "Đang hiển thị" },
  { value: "hidden", label: "Đã ẩn" },
];

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

function parseStatus(
  value: string | string[] | undefined,
): ReviewStatus | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return REVIEW_STATUSES.find((status) => status === raw);
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession({ redirectToLogin: true });

  const params = await searchParams;
  const status = parseStatus(params.status);
  const result = await listAdminReviews({
    page: parsePageParam(params.page),
    status,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cửa hàng online"
        title="Đánh giá sản phẩm"
        description="Kiểm duyệt đánh giá của khách: ẩn nội dung không phù hợp hoặc xoá hẳn. Điểm trung bình của sản phẩm được tính lại ngay."
      />

      <nav aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = (filter.value ?? undefined) === status;
          return (
            <Link
              key={filter.label}
              href={filter.value ? `${PATH}?status=${filter.value}` : PATH}
              aria-current={active ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: active ? "default" : "outline" }),
                "min-h-11",
              )}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách đánh giá ({result.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length > 0 ? (
            <ul className="divide-y">
              {result.items.map((review) => {
                const hidden = review.status === "hidden";
                return (
                  <li
                    key={review.id}
                    className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-start"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{review.authorName}</span>
                        <StarRating rating={review.rating} size="xs" />
                        {review.isVerifiedPurchase ? (
                          <span className="bg-success/10 text-success inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold">
                            <CheckCircle2
                              className="size-3"
                              aria-hidden="true"
                            />
                            Đã mua hàng
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold",
                            hidden
                              ? "bg-muted text-muted-foreground"
                              : "bg-success/15 text-success",
                          )}
                        >
                          {hidden ? "Đã ẩn" : "Đang hiển thị"}
                        </span>
                      </div>
                      <p className="text-foreground/90 text-sm whitespace-pre-line">
                        {review.content}
                      </p>
                      <div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
                        <Link
                          href={productHref(review.product)}
                          className="hover:text-primary underline-offset-2 hover:underline"
                        >
                          {review.product.name}
                        </Link>
                        <time dateTime={review.createdAt.toISOString()}>
                          {dateFormat.format(review.createdAt)}
                        </time>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await setReviewStatusAction(
                            review.id,
                            hidden ? "published" : "hidden",
                          );
                        }}
                      >
                        <Button type="submit" variant="outline" size="sm">
                          {hidden ? "Hiện" : "Ẩn"}
                        </Button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await deleteReviewAction(review.id);
                        }}
                      >
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                        >
                          Xoá
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="Chưa có đánh giá nào"
              description={
                status
                  ? "Không có đánh giá ở trạng thái này."
                  : "Đánh giá của khách sẽ xuất hiện tại đây sau khi họ gửi từ trang sản phẩm."
              }
            />
          )}

          <Pagination
            pathname={PATH}
            page={result.page}
            pageSize={ADMIN_REVIEWS_PAGE_SIZE}
            total={result.total}
            searchParams={params}
            label="Phân trang đánh giá"
          />
        </CardContent>
      </Card>
    </div>
  );
}

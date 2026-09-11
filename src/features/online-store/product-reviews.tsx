"use client";

import { useState } from "react";
import {
  CheckCircle2,
  MessageSquarePlus,
  Sparkles,
  ThumbsUp,
} from "lucide-react";

import { StarRating } from "@/components/kit/star-rating";

export interface CustomerReview {
  id: string;
  author: string;
  rating: number;
  date: string;
  verified: boolean;
  comment: string;
  helpfulCount: number;
}

const DEFAULT_REVIEWS: CustomerReview[] = [
  {
    id: "rev-1",
    author: "Thu Trang",
    rating: 5,
    date: "3 ngày trước",
    verified: true,
    comment:
      "Sản phẩm chất lượng vượt mong đợi, hạn sử dụng còn rất xa, giao hàng nhanh trong ngày.",
    helpfulCount: 14,
  },
  {
    id: "rev-2",
    author: "Văn Hùng",
    rating: 5,
    date: "1 tuần trước",
    verified: true,
    comment:
      "Giá cả hợp lý so với siêu thị, đóng gói chắc chắn không bị móp méo. Sẽ tiếp tục ủng hộ shop!",
    helpfulCount: 8,
  },
  {
    id: "rev-3",
    author: "Thanh Hương",
    rating: 4,
    date: "2 tuần trước",
    verified: true,
    comment: "Hàng chuẩn chính hãng, date mới. Shop tư vấn nhiệt tình.",
    helpfulCount: 5,
  },
];

export function ProductReviews({
  productId: _productId,
  productName: _productName,
}: {
  productId: string;
  productName: string;
}) {
  const [reviews, setReviews] = useState<CustomerReview[]>(DEFAULT_REVIEWS);
  const [showForm, setShowForm] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [authorName, setAuthorName] = useState("");
  const [comment, setComment] = useState("");
  const [helpfulVoted, setHelpfulVoted] = useState<Record<string, boolean>>({});
  const [submittedMessage, setSubmittedMessage] = useState(false);

  const averageRating =
    reviews.reduce((sum, r) => sum + r.rating, 0) / (reviews.length || 1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authorName.trim() || !comment.trim()) return;

    const newReview: CustomerReview = {
      id: `rev-${Date.now()}`,
      author: authorName.trim(),
      rating: newRating,
      date: "Vừa xong",
      verified: true,
      comment: comment.trim(),
      helpfulCount: 0,
    };

    setReviews([newReview, ...reviews]);
    setAuthorName("");
    setComment("");
    setShowForm(false);
    setSubmittedMessage(true);
    setTimeout(() => setSubmittedMessage(false), 5000);
  }

  function handleVoteHelpful(id: string) {
    if (helpfulVoted[id]) return;
    setHelpfulVoted((prev) => ({ ...prev, [id]: true }));
    setReviews((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, helpfulCount: r.helpfulCount + 1 } : r,
      ),
    );
  }

  return (
    <section className="surface-panel mt-10 rounded-2xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold">
            <span>Đánh giá từ khách hàng</span>
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <StarRating
              rating={averageRating}
              reviewCount={reviews.length}
              size="md"
            />
            <span className="text-muted-foreground text-xs">
              • 100% người mua hài lòng
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow transition-colors"
        >
          <MessageSquarePlus className="size-4" />
          <span>{showForm ? "Đóng form" : "Viết đánh giá"}</span>
        </button>
      </div>

      {submittedMessage && (
        <div className="animate-fade-in mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-700 dark:text-emerald-300">
          <Sparkles className="size-4 shrink-0 text-emerald-500" />
          <span>
            Cảm ơn bạn đã gửi đánh giá! Ý kiến của bạn giúp cửa hàng ngày càng
            hoàn thiện.
          </span>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-muted/40 mt-6 space-y-4 rounded-2xl border p-5"
        >
          <h3 className="text-base font-bold">
            Chia sẻ cảm nhận của bạn về sản phẩm
          </h3>

          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wider uppercase">
              Chấm điểm sản phẩm
            </label>
            <StarRating
              rating={newRating}
              interactive
              size="lg"
              onChange={setNewRating}
              showLabel
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wider uppercase">
                Tên hiển thị
              </label>
              <input
                type="text"
                required
                placeholder="Tên của bạn (VD: Minh Anh)"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="border-input bg-background h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-2"
              />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wider uppercase">
              Nội dung đánh giá
            </label>
            <textarea
              required
              rows={3}
              placeholder="Chia sẻ cảm nhận chân thực về chất lượng, đóng gói, giao hàng..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="border-input bg-background w-full rounded-xl border p-3 text-sm outline-none focus-visible:ring-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="hover:bg-muted rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-5 py-2 text-sm font-bold"
            >
              Gửi đánh giá
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-4 divide-y">
        {reviews.map((rev) => (
          <article key={rev.id} className="pt-4 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{rev.author}</span>
                {rev.verified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3" />
                    <span>Đã mua tại cửa hàng</span>
                  </span>
                )}
              </div>
              <span className="text-muted-foreground text-xs">{rev.date}</span>
            </div>

            <div className="mt-1.5">
              <StarRating rating={rev.rating} size="xs" />
            </div>

            <p className="text-foreground/90 mt-2 text-sm leading-relaxed">
              {rev.comment}
            </p>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleVoteHelpful(rev.id)}
                disabled={helpfulVoted[rev.id]}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                  helpfulVoted[rev.id]
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-muted-foreground hover:bg-muted border-border/50"
                }`}
              >
                <ThumbsUp className="size-3" />
                <span>Hữu ích ({rev.helpfulCount})</span>
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

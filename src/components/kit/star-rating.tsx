"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: "xs" | "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
  showLabel?: boolean;
  className?: string;
  "aria-label"?: string;
}

const RATING_LABELS: Record<number, string> = {
  1: "Rất không hài lòng",
  2: "Không hài lòng",
  3: "Bình thường",
  4: "Hài lòng",
  5: "Tuyệt vời",
};

const SIZE_CLASSES = {
  xs: "size-3.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
};

export function StarRating({
  rating,
  reviewCount,
  size = "md",
  interactive = false,
  onChange,
  showLabel = false,
  className = "",
  "aria-label": ariaLabel,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const activeRating = hoverRating ?? rating;
  const starSize = SIZE_CLASSES[size];

  if (interactive) {
    return (
      <div
        className={`inline-flex items-center gap-2 ${className}`}
        aria-label={ariaLabel ?? "Chọn số sao đánh giá"}
      >
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = star <= activeRating;
            return (
              <button
                key={star}
                type="button"
                aria-label={`${star} sao - ${RATING_LABELS[star]}`}
                onClick={() => onChange?.(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                className="rounded-lg p-1 text-amber-400 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none active:scale-95"
              >
                <Star
                  className={`${starSize} ${
                    isFilled
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/30 fill-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
        {showLabel && activeRating > 0 && (
          <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
            {RATING_LABELS[Math.round(activeRating)]}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-sm ${className}`}
      aria-label={`${rating} trên 5 sao`}
    >
      <div className="flex items-center gap-0.5 text-amber-400">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFull = rating >= star;
          const isHalf = !isFull && rating >= star - 0.5;

          return (
            <span key={star} className="relative inline-block">
              <Star
                className={`${starSize} ${
                  isFull
                    ? "fill-amber-400 text-amber-400"
                    : isHalf
                      ? "fill-amber-400/50 text-amber-400"
                      : "text-muted-foreground/30 fill-muted-foreground/15"
                }`}
              />
            </span>
          );
        })}
      </div>

      <span className="text-foreground text-xs font-bold">
        {rating.toFixed(1)}
      </span>

      {reviewCount !== undefined && (
        <span className="text-muted-foreground text-xs">
          ({reviewCount} đánh giá)
        </span>
      )}

      {showLabel && rating > 0 && (
        <span className="ml-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          {RATING_LABELS[Math.round(rating)]}
        </span>
      )}
    </div>
  );
}

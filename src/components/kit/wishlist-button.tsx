"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

import { useWishlist } from "@/lib/storage/wishlist";

export interface WishlistButtonProps {
  productId: string;
  productName: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const SIZES = {
  sm: "size-8",
  md: "size-9",
  lg: "size-11",
};

const ICON_SIZES = {
  sm: "size-4",
  md: "size-4.5",
  lg: "size-5",
};

export function WishlistButton({
  productId,
  productName,
  className = "",
  size = "md",
  showText = false,
}: WishlistButtonProps) {
  const { has, toggle } = useWishlist();
  const wishlisted = has(productId);
  const [bouncing, setBouncing] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBouncing(true);
    toggle(productId);
    setTimeout(() => setBouncing(false), 400);
  }

  const ariaLabel = wishlisted
    ? `Bỏ ${productName} khỏi danh sách yêu thích`
    : `Thêm ${productName} vào danh sách yêu thích`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={wishlisted}
      onClick={handleClick}
      className={`focus-visible:ring-primary inline-flex items-center justify-center rounded-full transition-all focus-visible:ring-2 focus-visible:outline-none ${
        showText ? "gap-2 px-3" : SIZES[size]
      } ${
        wishlisted
          ? "border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400"
          : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60 border backdrop-blur-sm"
      } ${bouncing ? "animate-badge-bounce" : ""} ${className}`}
    >
      <Heart
        className={`${ICON_SIZES[size]} transition-all ${
          wishlisted ? "scale-110 fill-rose-500 text-rose-500" : ""
        }`}
      />
      {showText && (
        <span className="text-xs font-semibold">
          {wishlisted ? "Đã thích" : "Yêu thích"}
        </span>
      )}
    </button>
  );
}

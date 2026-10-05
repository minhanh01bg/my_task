"use client";

import { useState, useTransition } from "react";

import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import type { ReviewActionResult } from "@/server/reviews/admin-reviews";

interface ReviewRowActionsProps {
  authorName: string;
  hidden: boolean;
  /** Server action đã `.bind(null, id, status)`. */
  toggleAction: () => Promise<ReviewActionResult>;
  /** Server action đã `.bind(null, id)`. */
  deleteAction: () => Promise<ReviewActionResult>;
}

const FALLBACK_ERROR = "Không thực hiện được. Vui lòng thử lại.";

export function ReviewRowActions({
  authorName,
  hidden,
  toggleAction,
  deleteAction,
}: ReviewRowActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function run(action: () => Promise<ReviewActionResult>) {
    setError(null);
    try {
      const result = await action();
      if (!result.ok) setError(result.error);
    } catch {
      setError(FALLBACK_ERROR);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => run(toggleAction))}
        >
          {hidden ? "Hiện" : "Ẩn"}
        </Button>
        <ConfirmAction
          action={() => run(deleteAction)}
          triggerLabel="Xoá"
          title={`Xoá đánh giá của “${authorName}”?`}
          description="Đánh giá sẽ bị xoá vĩnh viễn và điểm trung bình của sản phẩm được tính lại. Thao tác này không thể hoàn tác."
          confirmLabel="Xoá đánh giá"
          triggerClassName="text-destructive hover:bg-destructive/10"
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

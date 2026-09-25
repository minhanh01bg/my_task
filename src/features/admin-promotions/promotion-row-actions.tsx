"use client";

import { useState, useTransition } from "react";

import {
  deletePromotionAction,
  togglePromotionActiveAction,
} from "@/app/admin/promotions/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import type { PromotionActionResult } from "@/types/storefront";

interface PromotionRowActionsProps {
  id: string;
  title: string;
  isActive: boolean;
}

/**
 * Thao tác trên từng hàng chiến dịch khuyến mãi (Tạm dừng / Kích hoạt / Xóa).
 * Xóa bắt buộc phải qua modal xác nhận của ConfirmAction.
 */
export function PromotionRowActions({
  id,
  title,
  isActive,
}: PromotionRowActionsProps) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function report(result: PromotionActionResult) {
    setError(result.ok ? "" : result.error);
  }

  function toggle() {
    startTransition(async () => {
      report(await togglePromotionActiveAction(id, !isActive));
    });
  }

  async function remove() {
    report(await deletePromotionAction(id));
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={toggle}
        >
          {isActive ? "Tạm dừng" : "Kích hoạt"}
        </Button>
        <ConfirmAction
          action={remove}
          triggerLabel="Xóa"
          title={`Xóa chiến dịch “${title}”?`}
          description="Chiến dịch khuyến mãi sẽ bị xóa vĩnh viễn và không còn hiển thị trên cửa hàng online nữa."
          confirmLabel="Xóa chiến dịch"
          triggerClassName="text-destructive hover:bg-destructive/10 h-8 px-3 text-sm"
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

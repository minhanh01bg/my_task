"use client";

import {
  IconLoader2,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useState, useTransition } from "react";

import {
  deletePromotionAction,
  togglePromotionActiveAction,
} from "@/app/(management)/admin/promotions/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { useToast } from "@/components/ui/toast";
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
  const toast = useToast();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function report(result: PromotionActionResult) {
    setError(result.ok ? "" : result.error);
    toast.add({
      title: result.ok ? result.message : result.error,
      type: result.ok ? "success" : "error",
    });
  }

  function toggle() {
    startTransition(async () => {
      setError("");
      try {
        report(await togglePromotionActiveAction(id, !isActive));
      } catch {
        const message =
          "Không thể đổi trạng thái chiến dịch. Vui lòng thử lại.";
        setError(message);
        toast.add({ title: message, type: "error" });
      }
    });
  }

  async function remove() {
    try {
      report(await deletePromotionAction(id));
    } catch {
      const message = "Không thể xóa chiến dịch. Vui lòng thử lại.";
      setError(message);
      toast.add({ title: message, type: "error" });
    }
  }

  return (
    <fieldset
      disabled={pending}
      aria-label={`Thao tác chiến dịch ${title}`}
      aria-busy={pending}
      className="min-w-0 space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          onClick={toggle}
        >
          {pending ? (
            <IconLoader2
              aria-hidden="true"
              className="motion-safe:animate-spin"
            />
          ) : isActive ? (
            <IconPlayerPause aria-hidden="true" />
          ) : (
            <IconPlayerPlay aria-hidden="true" />
          )}
          {isActive ? "Tạm dừng" : "Kích hoạt"}
        </Button>
        <ConfirmAction
          action={remove}
          triggerLabel="Xóa"
          title={`Xóa chiến dịch “${title}”?`}
          description="Chiến dịch khuyến mãi sẽ bị xóa vĩnh viễn và không còn hiển thị trên cửa hàng online nữa."
          confirmLabel="Xóa chiến dịch"
          triggerClassName="text-destructive hover:bg-destructive/10 h-11 px-3 text-sm"
        />
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

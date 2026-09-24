"use client";

import { useState, useTransition } from "react";

import {
  deleteVoucherAction,
  toggleVoucherActiveAction,
} from "@/app/admin/promotions/vouchers/actions";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import type { VoucherActionResult } from "@/types/voucher";

interface VoucherRowActionsProps {
  id: string;
  code: string;
  isActive: boolean;
}

/**
 * Tam dung/kich hoat va xoa mot ma. Xoa phai xac nhan; action tra
 * `{ ok: false }` thi bao loi ngay tai dong (khong nuot loi).
 */
export function VoucherRowActions({
  id,
  code,
  isActive,
}: VoucherRowActionsProps) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function report(result: VoucherActionResult) {
    setError(result.ok ? "" : result.error);
  }

  function toggle() {
    startTransition(async () => {
      report(await toggleVoucherActiveAction(id, !isActive));
    });
  }

  async function remove() {
    report(await deleteVoucherAction(id));
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
          title={`Xóa mã “${code}”?`}
          description="Khách sẽ không dùng được mã này nữa. Đơn đã dùng mã vẫn giữ nguyên số tiền đã giảm."
          confirmLabel="Xóa mã"
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

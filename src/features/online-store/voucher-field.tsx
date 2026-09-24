"use client";

import { TicketPercent } from "lucide-react";

import { formatVnd } from "@/lib/money";

import type { useVoucher } from "./use-voucher";

interface VoucherFieldProps {
  voucher: ReturnType<typeof useVoucher>;
  id: string;
  className?: string;
}

/** Ô nhập mã giảm giá dùng chung cho giỏ hàng và trang thanh toán. */
export function VoucherField({ voucher, id, className }: VoucherFieldProps) {
  const { applied, pendingCode, error, pending } = voucher;
  const locked = Boolean(applied || pendingCode);

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase"
      >
        <TicketPercent aria-hidden="true" className="size-3.5" />
        Mã ưu đãi / Voucher
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          autoComplete="off"
          placeholder="Nhập mã voucher"
          maxLength={50}
          value={voucher.input}
          onChange={(event) => voucher.setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!locked && !pending) void voucher.apply();
            }
          }}
          disabled={locked}
          className="border-input bg-background focus-visible:ring-ring/40 h-10 min-w-0 flex-1 rounded-xl border px-3 text-sm uppercase outline-none focus-visible:ring-2 disabled:opacity-70"
        />
        {locked ? (
          <button
            type="button"
            onClick={voucher.remove}
            className="text-destructive border-destructive/30 hover:bg-destructive/10 h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors"
          >
            Gỡ mã
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void voucher.apply()}
            disabled={pending}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/85 h-10 shrink-0 rounded-xl px-3.5 text-xs font-bold transition-colors disabled:opacity-60"
          >
            {pending ? "Đang kiểm tra…" : "Áp dụng"}
          </button>
        )}
      </div>
      <p aria-live="polite" className="min-h-0 text-xs">
        {error ? (
          <span className="text-destructive mt-1.5 block">{error}</span>
        ) : applied ? (
          <span className="text-success mt-1.5 block font-medium">
            {applied.discount > 0
              ? `Đã áp dụng mã ${applied.code}: giảm ${formatVnd(applied.discount)} ₫`
              : applied.type === "freeship"
                ? `Đã áp dụng mã ${applied.code}: miễn phí giao hàng`
                : `Đã áp dụng mã ${applied.code}`}
          </span>
        ) : null}
      </p>
    </div>
  );
}

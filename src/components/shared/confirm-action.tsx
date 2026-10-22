"use client";

import { IconAlertCircle as WarningCircle } from "@tabler/icons-react";
import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AdminActionResult } from "@/types/admin-action";

interface ConfirmActionProps {
  /** Trả `{ ok: false }` thì giữ hộp thoại mở và hiện `message`. */
  action: () => Promise<void | AdminActionResult>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "destructive";
  triggerClassName?: string;
  triggerIcon?: ReactNode;
  triggerAriaLabel?: string;
}

export function ConfirmAction({
  action,
  triggerLabel,
  title,
  description,
  confirmLabel = "Xác nhận",
  triggerVariant = "ghost",
  triggerClassName,
  triggerIcon,
  triggerAriaLabel,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError("");
  }

  async function handleConfirm() {
    setIsPending(true);
    setError("");
    try {
      const result = await action();
      if (result && !result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerIcon ? "icon" : "default"}
            aria-label={triggerAriaLabel}
            className={
              triggerIcon
                ? `size-11 ${triggerClassName ?? ""}`
                : triggerClassName
            }
          />
        }
      >
        {triggerIcon ?? triggerLabel}
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader className="gap-3">
          <span className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full">
            <WarningCircle aria-hidden="true" className="size-6" />
          </span>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {error}
          </p>
        ) : null}
        <DialogFooter className="-mx-6 -mb-6 p-5">
          <DialogClose render={<Button type="button" variant="outline" />}>
            Quay lại
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? "Đang xử lý…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { WarningCircle } from "@phosphor-icons/react";

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

interface ConfirmActionProps {
  action: () => Promise<void>;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost" | "destructive";
  triggerClassName?: string;
}

export function ConfirmAction({
  action,
  triggerLabel,
  title,
  description,
  confirmLabel = "Xác nhận",
  triggerVariant = "ghost",
  triggerClassName,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function handleConfirm() {
    setIsPending(true);
    try {
      await action();
      setOpen(false);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant={triggerVariant}
            className={triggerClassName}
          />
        }
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-md">
        <DialogHeader className="gap-3">
          <span className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full">
            <WarningCircle
              aria-hidden="true"
              weight="fill"
              className="size-6"
            />
          </span>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-base leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
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

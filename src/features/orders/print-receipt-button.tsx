"use client";

import { Printer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { ReceiptK80, type ReceiptK80Props } from "./receipt-k80";

interface PrintReceiptButtonProps extends Omit<
  ReceiptK80Props,
  "showPrintButton"
> {
  label?: string;
  className?: string;
}

/**
 * Mo xem truoc hoa don K80 trong hop thoai; nut "In hoa don (K80)" ben trong
 * portal ban in ra ngoai hop thoai (duoi `body`) roi goi window.print() — xem
 * `ReceiptK80` va CSS in trong globals.css.
 */
export function PrintReceiptButton({
  label = "In hoá đơn",
  className,
  ...receipt
}: PrintReceiptButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn("min-h-11 font-bold print:hidden", className)}
        onClick={() => setOpen(true)}
      >
        <Printer aria-hidden="true" className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="modal-scroll max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogTitle>Hoá đơn {receipt.order.code}</DialogTitle>
          <DialogDescription className="sr-only">
            Xem trước hoá đơn khổ K80 trước khi in
          </DialogDescription>
          {open ? <ReceiptK80 {...receipt} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

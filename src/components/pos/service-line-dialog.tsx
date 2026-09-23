"use client";

import { useState } from "react";

import { TouchButton } from "@/components/kit";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/stores/cart-store";

interface ServiceLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Them dong tien cong (VD "Cong thay nhot") — khong tru ton kho. */
export function ServiceLineDialog({
  open,
  onOpenChange,
}: ServiceLineDialogProps) {
  const addService = useCartStore((state) => state.addService);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = Math.round(Number(amount) || 0);
    if (!name.trim() || value <= 0) return;

    addService(name.trim(), value);
    setName("");
    setAmount("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        className="bg-background block rounded-3xl p-6 sm:max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogTitle className="font-sans text-xl leading-tight font-semibold">
            Thêm tiền công
          </DialogTitle>

          <div className="space-y-1.5">
            <Label htmlFor="service-name">Tên dịch vụ</Label>
            <Input
              id="service-name"
              aria-label="Tên dịch vụ"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="VD: Công thay nhớt"
              className="h-11 text-lg"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-amount">Số tiền</Label>
            <Input
              id="service-amount"
              aria-label="Số tiền"
              type="number"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Số tiền"
              className="h-11 text-right text-lg tabular-nums"
            />
          </div>

          <div className="flex gap-2">
            <DialogClose
              render={
                <TouchButton
                  type="button"
                  variant="outline"
                  className="flex-1"
                />
              }
            >
              Huỷ
            </DialogClose>
            <TouchButton type="submit" className="flex-1">
              Thêm
            </TouchButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

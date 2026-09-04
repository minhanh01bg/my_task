"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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

  if (!open) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-background w-full max-w-md space-y-4 rounded-lg p-6"
      >
        <h2 className="text-xl font-semibold">Thêm tiền công</h2>

        <input
          aria-label="Tên dịch vụ"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          placeholder="VD: Công thay nhớt"
          className="w-full rounded border px-4 py-3 text-lg"
        />

        <input
          aria-label="Số tiền"
          type="number"
          min="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Số tiền"
          className="w-full rounded border px-4 py-3 text-right text-lg tabular-nums"
        />

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button type="submit" className="flex-1">
            Thêm
          </Button>
        </div>
      </form>
    </div>
  );
}

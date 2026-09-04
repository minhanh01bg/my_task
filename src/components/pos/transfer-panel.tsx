"use client";

import QRCode from "qrcode";
import { useEffect, useRef } from "react";

import { buildVietQrPayload } from "@/lib/vietqr/build";
import type { BankAccount } from "@/lib/vietqr/types";
import { Money } from "@/components/kit";

interface TransferPanelProps {
  amount: number;
  description: string;
  bankAccount: BankAccount | null;
}

/**
 * QR sinh ngay trong may — mat mang van hien duoc va khach van chuyen khoan duoc.
 */
export function TransferPanel({
  amount,
  description,
  bankAccount,
}: TransferPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!bankAccount || !canvasRef.current) return;

    const payload = buildVietQrPayload({
      account: bankAccount,
      amount,
      description,
    });

    void QRCode.toCanvas(canvasRef.current, payload, {
      width: 260,
      margin: 1,
    });
  }, [amount, description, bankAccount]);

  if (!bankAccount) {
    return (
      <p className="text-muted-foreground py-10 text-center">
        Chưa cấu hình tài khoản ngân hàng. Vào Quản lý → Cài đặt để khai báo.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} data-testid="vietqr-canvas" />
      <div className="text-center">
        <Money amount={amount} className="text-2xl" />
        <p className="text-muted-foreground text-sm">
          Nội dung: <span className="font-medium">{description}</span>
        </p>
        <p className="text-muted-foreground text-sm">
          {bankAccount.accountName} — {bankAccount.accountNumber}
        </p>
      </div>
    </div>
  );
}

"use client";

import { Printer } from "lucide-react";

import { formatVnd } from "@/lib/money";

export interface ReceiptLine {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

export interface ReceiptOrder {
  code: string;
  createdAt: string;
  cashier?: string;
  customerName?: string;
  customerPhone?: string;
  lines: ReceiptLine[];
  subtotal: number;
  discount?: number;
  total: number;
  payments?: Array<{ method: string; amount: number; change?: number }>;
  note?: string;
}

export interface ReceiptK80Props {
  storeName: string;
  storeAddress?: string;
  storeHotline?: string;
  order: ReceiptOrder;
  showPrintButton?: boolean;
}

export function ReceiptK80({
  storeName,
  storeAddress,
  storeHotline,
  order,
  showPrintButton = true,
}: ReceiptK80Props) {
  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <div className="flex flex-col items-center">
      {showPrintButton && (
        <div className="mb-4 flex gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow transition-colors"
          >
            <Printer className="size-4" />
            <span>In hóa đơn (K80)</span>
          </button>
        </div>
      )}

      {/* K80 Thermal Receipt Container */}
      <div
        className="w-[80mm] max-w-full border border-dashed border-gray-300 bg-white p-3 font-mono text-[11px] leading-tight text-black shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none"
        style={{ colorScheme: "light" }}
      >
        {/* Header */}
        <div className="border-b border-black pb-2 text-center">
          <h2 className="text-sm font-black tracking-wider uppercase">
            {storeName.toUpperCase()}
          </h2>
          {storeAddress && (
            <p className="mt-0.5 text-[10px] text-gray-700">{storeAddress}</p>
          )}
          {storeHotline && (
            <p className="text-[10px] text-gray-700">Hotline: {storeHotline}</p>
          )}
          <h3 className="mt-1.5 text-xs font-extrabold uppercase">
            HÓA ĐƠN BÁN HÀNG
          </h3>
          <p className="text-[10px] font-bold">Mã ĐH: {order.code}</p>
        </div>

        {/* Metadata */}
        <div className="space-y-0.5 border-b border-dashed border-black py-1.5 text-[10px]">
          <div className="flex justify-between">
            <span>Ngày in:</span>
            <span>{order.createdAt}</span>
          </div>
          {order.cashier && (
            <div className="flex justify-between">
              <span>Thu ngân:</span>
              <span>{order.cashier}</span>
            </div>
          )}
          {order.customerName && (
            <div className="flex justify-between">
              <span>Khách hàng:</span>
              <span>
                {order.customerName}{" "}
                {order.customerPhone ? `(${order.customerPhone})` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="border-b border-black py-2">
          <div className="flex justify-between border-b border-dashed border-gray-400 pb-1 text-[10px] font-bold">
            <span className="w-1/2">Tên hàng</span>
            <span className="w-1/4 text-center">SL x Giá</span>
            <span className="w-1/4 text-right">T.Tiền</span>
          </div>

          <div className="divide-y divide-dashed divide-gray-200 py-1">
            {order.lines.map((line, idx) => (
              <div key={idx} className="py-1">
                <div className="text-[10.5px] font-semibold">{line.name}</div>
                <div className="flex justify-between text-[10px] text-gray-800">
                  <span className="w-1/2" />
                  <span className="w-1/4 text-center">
                    {line.quantity}
                    {line.unit ? ` ${line.unit}` : ""} x{" "}
                    {formatVnd(line.unitPrice)}
                  </span>
                  <span className="w-1/4 text-right font-bold">
                    {formatVnd(line.total)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="space-y-1 border-b border-black py-2 text-[11px]">
          <div className="flex justify-between">
            <span>Tổng tiền hàng:</span>
            <span>{formatVnd(order.subtotal)} ₫</span>
          </div>

          {order.discount ? (
            <div className="flex justify-between font-medium">
              <span>Chiết khấu / Giảm giá:</span>
              <span>- {formatVnd(order.discount)} ₫</span>
            </div>
          ) : null}

          <div className="flex justify-between border-t border-dashed border-black pt-1 text-xs font-black">
            <span>THANH TOÁN:</span>
            <span>{formatVnd(order.total)} ₫</span>
          </div>

          {order.payments && order.payments.length > 0 ? (
            <div className="space-y-0.5 pt-1 text-[10px] text-gray-700">
              {order.payments.map((p, idx) => (
                <div key={idx}>
                  <div className="flex justify-between">
                    <span>
                      Tiền khách đưa (
                      {p.method === "cash"
                        ? "Tiền mặt"
                        : p.method === "transfer"
                          ? "Chuyển khoản"
                          : p.method}
                      ):
                    </span>
                    <span>{formatVnd(p.amount)} ₫</span>
                  </div>
                  {p.change !== undefined && p.change > 0 && (
                    <div className="flex justify-between font-bold text-black">
                      <span>Tiền thối lại:</span>
                      <span>{formatVnd(p.change)} ₫</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Note */}
        {order.note ? (
          <div className="border-b border-dashed border-gray-300 py-1 text-[10px] italic">
            Ghi chú: {order.note}
          </div>
        ) : null}

        {/* Footer */}
        <div className="space-y-1 pt-2 text-center text-[10px]">
          <p className="font-bold tracking-wider uppercase">
            CẢM ƠN QUÝ KHÁCH - HẸN GẶP LẠI
          </p>
          <p className="text-[9px] text-gray-600">
            (Quý khách vui lòng kiểm tra hóa đơn & hàng trước khi rời quầy)
          </p>
        </div>
      </div>
    </div>
  );
}

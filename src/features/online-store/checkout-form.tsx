"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatVnd } from "@/lib/money";
import { onlineOrderResponseSchema } from "@/types/online-order";

import { OnlineCartProvider, useOnlineCart } from "./cart-context";

function FormContent() {
  const { lines, clear, setQuantity, remove } = useOnlineCart();
  const router = useRouter();
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const total = lines.reduce(
    (sum, line) => sum + Math.round(line.price * line.quantity),
    0,
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length || pending) return;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      clientId: crypto.randomUUID(),
      lines: lines.map((line) => ({
        productId: line.id,
        quantity: line.quantity,
      })),
      contactName: data.get("contactName"),
      contactPhone: data.get("contactPhone"),
      fulfillmentType: fulfillment,
      paymentMethod: data.get("paymentMethod"),
      deliveryAddress:
        fulfillment === "delivery" ? data.get("deliveryAddress") : "",
      deliveryWard: fulfillment === "delivery" ? data.get("deliveryWard") : "",
      deliveryDistrict:
        fulfillment === "delivery" ? data.get("deliveryDistrict") : "",
      deliveryProvince:
        fulfillment === "delivery" ? data.get("deliveryProvince") : "",
      note: data.get("note"),
    };
    try {
      const response = await fetch("/api/online/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof body === "object" && body && "message" in body
            ? String(body.message)
            : "Không thể đặt hàng";
        throw new Error(message);
      }
      const parsed = onlineOrderResponseSchema.parse(body);
      clear();
      router.push(
        parsed.data.order.accessUrl ??
          `/order-success/${encodeURIComponent(parsed.data.order.code)}`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đặt hàng");
      setPending(false);
    }
  }

  if (!lines.length)
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold">Giỏ hàng đang trống</h1>
        <Link
          href="/shop"
          className="bg-primary text-primary-foreground mt-6 inline-flex min-h-11 items-center rounded-xl px-5 font-bold"
        >
          Tiếp tục mua sắm
        </Link>
      </main>
    );

  const inputClass =
    "border-input bg-background h-12 w-full rounded-xl border px-3 outline-none focus-visible:ring-3";
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link href="/shop" className="text-primary font-bold">
        ← Quay lại cửa hàng
      </Link>
      <h1 className="font-heading mt-5 text-4xl font-bold">
        Thông tin đặt hàng
      </h1>
      <form
        onSubmit={submit}
        className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]"
      >
        <div className="space-y-6">
          <section className="border-border rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Liên hệ</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="font-bold">
                Họ và tên
                <input
                  required
                  name="contactName"
                  minLength={2}
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="font-bold">
                Số điện thoại
                <input
                  required
                  name="contactPhone"
                  inputMode="tel"
                  className={`${inputClass} mt-2`}
                />
              </label>
            </div>
          </section>
          <section className="border-border rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Nhận hàng</h2>
            <div className="mt-4 flex gap-3">
              <label className="border-border flex min-h-11 flex-1 items-center gap-2 rounded-xl border p-3">
                <input
                  type="radio"
                  checked={fulfillment === "delivery"}
                  onChange={() => setFulfillment("delivery")}
                />{" "}
                Giao tận nơi
              </label>
              <label className="border-border flex min-h-11 flex-1 items-center gap-2 rounded-xl border p-3">
                <input
                  type="radio"
                  checked={fulfillment === "pickup"}
                  onChange={() => setFulfillment("pickup")}
                />{" "}
                Nhận tại cửa hàng
              </label>
            </div>
            {fulfillment === "delivery" ? (
              <div className="mt-4 grid gap-4">
                <label className="font-bold">
                  Địa chỉ
                  <input
                    required
                    name="deliveryAddress"
                    className={`${inputClass} mt-2`}
                  />
                </label>
                <label className="font-bold">
                  Phường/xã
                  <input name="deliveryWard" className={`${inputClass} mt-2`} />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="font-bold">
                    Quận/huyện
                    <input
                      required
                      name="deliveryDistrict"
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <label className="font-bold">
                    Tỉnh/thành phố
                    <input
                      required
                      name="deliveryProvince"
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </section>
          <section className="border-border rounded-2xl border p-5">
            <h2 className="text-xl font-bold">Thanh toán</h2>
            <label className="mt-4 flex min-h-11 items-center gap-2">
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                defaultChecked
              />{" "}
              COD khi nhận hàng
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="radio" name="paymentMethod" value="bank_transfer" />{" "}
              Chuyển khoản thủ công
            </label>
            <label className="mt-4 block font-bold">
              Ghi chú
              <textarea
                name="note"
                maxLength={500}
                className="border-input bg-background mt-2 min-h-24 w-full rounded-xl border p-3"
              />
            </label>
          </section>
        </div>
        <aside className="border-border h-fit rounded-2xl border p-5 lg:sticky lg:top-6">
          <h2 className="text-xl font-bold">Đơn hàng</h2>
          <ul className="mt-4 divide-y">
            {lines.map((line) => (
              <li key={line.id} className="py-4">
                <div className="flex justify-between gap-3">
                  <span className="font-bold">{line.name}</span>
                  <button
                    type="button"
                    onClick={() => remove(line.id)}
                    className="text-destructive min-h-11"
                  >
                    Xóa
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <input
                    aria-label={`Số lượng ${line.name}`}
                    type="number"
                    min="0.01"
                    max={line.stock}
                    step="0.01"
                    value={line.quantity}
                    onChange={(event) =>
                      setQuantity(line.id, Number(event.target.value))
                    }
                    className="border-input h-11 w-24 rounded-lg border px-2"
                  />
                  <strong>
                    {formatVnd(Math.round(line.price * line.quantity))} ₫
                  </strong>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold">
            <span>Tổng cộng</span>
            <span>{formatVnd(total)} ₫</span>
          </div>
          {error ? (
            <p role="alert" className="text-destructive mt-4">
              {error}
            </p>
          ) : null}
          <button
            disabled={pending}
            className="bg-primary text-primary-foreground mt-5 min-h-12 w-full rounded-xl font-bold disabled:opacity-60"
          >
            {pending ? "Đang đặt hàng…" : "Xác nhận đặt hàng"}
          </button>
        </aside>
      </form>
    </main>
  );
}

export function CheckoutForm() {
  return (
    <OnlineCartProvider>
      <FormContent />
    </OnlineCartProvider>
  );
}

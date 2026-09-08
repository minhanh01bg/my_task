"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { formatFullAddress } from "@/lib/address/vietnam-address";
import { formatVnd } from "@/lib/money";
import { onlineOrderResponseSchema } from "@/types/online-order";
import type { PublicStoreProfile } from "@/types/storefront";

import { AddressFields, type AddressState } from "./address-fields";
import { OnlineCartProvider, useOnlineCart } from "./cart-context";

function FormContent({ storeProfile }: { storeProfile?: PublicStoreProfile }) {
  const { lines, hydrated, clear, setQuantity, remove } = useOnlineCart();
  const router = useRouter();
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [address, setAddress] = useState<AddressState>({
    provinceCode: "",
    districtCode: "",
    wardCode: "",
    provinceName: "",
    districtName: "",
    wardName: "",
    street: "",
    isManual: false,
  });
  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const total = lines.reduce(
    (sum, line) => sum + Math.round(line.price * line.quantity),
    0,
  );

  const formattedAddress = formatFullAddress({
    street: address.street,
    ward: address.wardName,
    district: address.districtName,
    province: address.provinceName,
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lines.length || pending) return;
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      clientId,
      lines: lines.map((line) => ({
        productId: line.id,
        quantity: line.quantity,
      })),
      contactName: data.get("contactName"),
      contactPhone: data.get("contactPhone"),
      fulfillmentType: fulfillment,
      paymentMethod: data.get("paymentMethod"),
      deliveryAddress:
        fulfillment === "delivery"
          ? (data.get("deliveryAddress") as string) || address.street
          : "",
      deliveryWard:
        fulfillment === "delivery"
          ? (data.get("deliveryWard") as string) || address.wardName
          : "",
      deliveryDistrict:
        fulfillment === "delivery"
          ? (data.get("deliveryDistrict") as string) || address.districtName
          : "",
      deliveryProvince:
        fulfillment === "delivery"
          ? (data.get("deliveryProvince") as string) || address.provinceName
          : "",
      provinceCode:
        fulfillment === "delivery" && !address.isManual && address.provinceCode
          ? address.provinceCode
          : undefined,
      districtCode:
        fulfillment === "delivery" && !address.isManual && address.districtCode
          ? address.districtCode
          : undefined,
      wardCode:
        fulfillment === "delivery" && !address.isManual && address.wardCode
          ? address.wardCode
          : undefined,
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
      setClientId(crypto.randomUUID());
      router.push(
        parsed.data.order.accessUrl ?? parsed.data.order.receiptUrl ?? "/shop",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể đặt hàng");
      setPending(false);
    }
  }

  if (!hydrated || !lines.length)
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
              <div className="mt-4">
                <AddressFields
                  value={address}
                  onChange={setAddress}
                  inputClass={inputClass}
                />
                {formattedAddress ? (
                  <div
                    data-testid="address-summary"
                    className="border-border bg-muted/40 mt-4 rounded-xl border p-3.5 text-sm"
                  >
                    <span className="text-muted-foreground font-semibold">
                      Địa chỉ nhận hàng:
                    </span>
                    <p className="mt-1 font-medium">{formattedAddress}</p>
                  </div>
                ) : null}
              </div>
            ) : null}
            {fulfillment === "pickup" ? (
              <div
                data-testid="pickup-store-info"
                className="border-border bg-card/60 mt-4 rounded-2xl border p-4 text-sm"
              >
                <h3 className="text-foreground mb-2 text-base font-bold">
                  Thông tin nhận hàng tại cửa hàng
                </h3>
                {storeProfile?.address ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground">
                      <strong className="text-foreground">
                        Địa chỉ nhận hàng:{" "}
                      </strong>
                      {storeProfile.address}
                    </p>
                    {storeProfile.openingHours ? (
                      <p className="text-muted-foreground">
                        <strong className="text-foreground">
                          Giờ nhận hàng:{" "}
                        </strong>
                        {storeProfile.openingHours}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-4 pt-1">
                      {storeProfile.hotline ? (
                        <a
                          href={`tel:${storeProfile.hotline.replace(/\s+/g, "")}`}
                          className="text-primary font-semibold hover:underline"
                        >
                          Hotline: {storeProfile.hotline}
                        </a>
                      ) : null}
                      {storeProfile.mapUrl &&
                      storeProfile.mapUrl.startsWith("https://") ? (
                        <a
                          href={storeProfile.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          <span>Xem trên bản đồ & chỉ đường</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground space-y-1 text-sm">
                    <p>
                      Cửa hàng chưa cập nhật địa chỉ nhận hàng cụ thể trên hệ
                      thống.
                    </p>
                    <p>
                      Quý khách vui lòng liên hệ hotline{" "}
                      {storeProfile?.hotline ? (
                        <a
                          href={`tel:${storeProfile.hotline.replace(/\s+/g, "")}`}
                          className="text-primary font-bold hover:underline"
                        >
                          {storeProfile.hotline}
                        </a>
                      ) : (
                        "cửa hàng"
                      )}{" "}
                      để được hỗ trợ hướng dẫn nhận hàng trực tiếp.
                    </p>
                  </div>
                )}
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

          <div
            data-testid="checkout-reassurance"
            className="border-border/60 bg-muted/30 text-muted-foreground mt-6 space-y-2.5 rounded-xl border p-4 text-xs"
          >
            <div className="flex items-start gap-2">
              <ShieldCheck
                className="text-primary mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                <strong className="text-foreground">
                  Đồng kiểm trước khi nhận:{" "}
                </strong>
                Quý khách có quyền kiểm tra hàng trước khi thanh toán.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2
                className="text-primary mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                <strong className="text-foreground">
                  Thanh toán linh hoạt COD hoặc VietQR:{" "}
                </strong>
                Giá minh bạch từ hệ thống, không phụ phí ẩn.
              </p>
            </div>
            <div className="border-border/60 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-[0.7rem]">
              <span>Chính sách:</span>
              <Link
                href="/shop/delivery-policy"
                target="_blank"
                className="text-primary hover:underline"
              >
                Chính sách giao hàng
              </Link>
              <span>•</span>
              <Link
                href="/shop/return-policy"
                target="_blank"
                className="text-primary hover:underline"
              >
                Chính sách đổi trả
              </Link>
            </div>
          </div>
        </aside>
      </form>
    </main>
  );
}

export function CheckoutForm({
  storeProfile,
}: {
  storeProfile?: PublicStoreProfile;
} = {}) {
  return (
    <OnlineCartProvider>
      <FormContent storeProfile={storeProfile} />
    </OnlineCartProvider>
  );
}

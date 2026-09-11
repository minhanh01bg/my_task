"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { formatFullAddress } from "@/lib/address/vietnam-address";
import { formatVnd } from "@/lib/money";
import { validateVoucher } from "@/lib/vouchers/validate-voucher";
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
  const [deliverySlot, setDeliverySlot] = useState(
    "Giao sớm nhất có thể (Tiêu chuẩn)",
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
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [voucherError, setVoucherError] = useState("");

  const [clientId, setClientId] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const subtotal = lines.reduce(
    (sum, line) => sum + Math.round(line.price * line.quantity),
    0,
  );
  const discount = appliedVoucher ? appliedVoucher.discount : 0;
  const finalTotal = Math.max(0, subtotal - discount);

  function handleApplyVoucher() {
    setVoucherError("");
    const result = validateVoucher(voucherInput, subtotal);
    if (!result.valid) {
      setVoucherError(result.message);
      setAppliedVoucher(null);
      return;
    }
    setAppliedVoucher({
      code: result.code!,
      discount: result.discount,
    });
  }

  function handleRemoveVoucher() {
    setAppliedVoucher(null);
    setVoucherInput("");
    setVoucherError("");
  }

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
      deliverySlot: fulfillment === "delivery" ? deliverySlot : undefined,
      voucherCode: appliedVoucher ? appliedVoucher.code : undefined,
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
              <div className="mt-4 space-y-4">
                <AddressFields
                  value={address}
                  onChange={setAddress}
                  inputClass={inputClass}
                />
                {formattedAddress ? (
                  <div
                    data-testid="address-summary"
                    className="border-border bg-muted/40 rounded-xl border p-3.5 text-sm"
                  >
                    <span className="text-muted-foreground font-semibold">
                      Địa chỉ nhận hàng:
                    </span>
                    <p className="mt-1 font-medium">{formattedAddress}</p>
                  </div>
                ) : null}

                <div className="border-border/60 border-t pt-4">
                  <label className="block text-sm font-bold">
                    Thời gian nhận hàng
                    <select
                      aria-label="Khung giờ giao"
                      name="deliverySlot"
                      value={deliverySlot}
                      onChange={(e) => setDeliverySlot(e.target.value)}
                      className={`${inputClass} mt-1.5`}
                    >
                      <option value="Giao sớm nhất có thể (Tiêu chuẩn)">
                        Giao sớm nhất có thể (Tiêu chuẩn)
                      </option>
                      <option value="08:00 - 11:30">
                        08:00 - 11:30 (Buổi sáng)
                      </option>
                      <option value="13:30 - 17:30">
                        13:30 - 17:30 (Buổi chiều)
                      </option>
                      <option value="18:00 - 21:00">
                        18:00 - 21:00 (Buổi tối)
                      </option>
                    </select>
                  </label>
                </div>
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
        <aside className="border-border surface-panel h-fit rounded-2xl border p-5 lg:sticky lg:top-24">
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

          <div className="border-border/60 mt-4 space-y-2 border-t pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tạm tính:</span>
              <span className="font-semibold">{formatVnd(subtotal)} ₫</span>
            </div>

            {appliedVoucher ? (
              <div className="flex justify-between text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Giảm giá ({appliedVoucher.code}):</span>
                <span>- {formatVnd(appliedVoucher.discount)} ₫</span>
              </div>
            ) : null}

            <div className="mt-3 border-t border-dashed pt-3">
              <label className="text-muted-foreground mb-1.5 block text-xs font-semibold tracking-wider uppercase">
                Mã ưu đãi / Voucher
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nhập mã voucher (VD: FREESHIP, GIAM20K)"
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value)}
                  disabled={!!appliedVoucher}
                  className="border-input bg-background h-10 flex-1 rounded-xl border px-3 text-xs uppercase outline-none focus-visible:ring-2"
                />
                {appliedVoucher ? (
                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 h-10 rounded-xl border px-3 text-xs font-semibold transition-colors"
                  >
                    Gỡ
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyVoucher}
                    className="bg-secondary text-secondary-foreground hover:bg-secondary/85 h-10 rounded-xl px-3.5 text-xs font-bold transition-colors"
                  >
                    Áp dụng
                  </button>
                )}
              </div>
              {voucherError ? (
                <p className="text-destructive mt-1.5 text-xs">
                  {voucherError}
                </p>
              ) : null}
              {appliedVoucher ? (
                <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Đã áp dụng: Giảm {formatVnd(appliedVoucher.discount)} ₫
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex justify-between border-t pt-4 text-xl font-bold">
            <span>Tổng cộng</span>
            <span>{formatVnd(finalTotal)} ₫</span>
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

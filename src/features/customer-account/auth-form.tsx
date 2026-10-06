"use client";

import { Eye, EyeOff, LockKeyhole, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { customerReturnPath } from "@/lib/auth/customer-return-path";
import { invalidateStorefrontSession } from "@/features/online-store/storefront-session";
import {
  customerLoginSchema,
  customerRegisterSchema,
} from "@/types/customer-auth";

type Field = "phone" | "password" | "displayName";

export function CustomerAuthForm({
  mode,
  returnTo,
}: {
  mode: "login" | "register";
  returnTo?: string;
}) {
  const destination = customerReturnPath(returnTo);
  const authHref = (path: string) =>
    destination === "/account/orders"
      ? path
      : `${path}?next=${encodeURIComponent(destination)}`;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<Field, string>>
  >({});
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const element = event.currentTarget;
    const form = new FormData(element);
    const body = {
      phone: String(form.get("phone") ?? ""),
      password: String(form.get("password") ?? ""),
      ...(mode === "register"
        ? { displayName: String(form.get("displayName") ?? "") }
        : {}),
    };
    setError("");
    setSuccess("");
    const parsed = (
      mode === "login" ? customerLoginSchema : customerRegisterSchema
    ).safeParse(body);
    if (!parsed.success) {
      const errors: Partial<Record<Field, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field;
        if (field === "phone")
          errors.phone = body.phone.trim()
            ? "Số điện thoại không hợp lệ."
            : "Vui lòng nhập số điện thoại.";
        if (field === "password")
          errors.password = body.password
            ? "Mật khẩu cần từ 10 đến 128 ký tự."
            : "Vui lòng nhập mật khẩu.";
        if (field === "displayName")
          errors.displayName = "Họ và tên cần từ 2 đến 100 ký tự.";
      }
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      element.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const response = await fetch(`/api/customer-auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          typeof result.message === "string"
            ? result.message
            : "Không thể tiếp tục. Vui lòng thử lại.",
        );
        return;
      }
      if (mode === "register") {
        setSuccess(
          typeof result.message === "string"
            ? result.message
            : "Tài khoản đã được xử lý. Vui lòng đăng nhập để tiếp tục.",
        );
        return;
      }
      invalidateStorefrontSession();
      router.replace(destination);
      router.refresh();
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  }

  function clearError(field: Field) {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError("");
  }

  function fieldError(field: Field) {
    return fieldErrors[field] ? (
      <p
        id={`customer-${field}-error`}
        role="alert"
        className="text-destructive text-sm font-medium"
      >
        {fieldErrors[field]}
      </p>
    ) : null;
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="mx-auto w-full max-w-md space-y-5"
    >
      {mode === "register" ? (
        <div className="space-y-2">
          <label htmlFor="customer-displayName" className="text-sm font-bold">
            Họ và tên
          </label>
          <div className="relative">
            <UserRound
              aria-hidden="true"
              className="text-muted-foreground absolute top-1/2 left-4 size-5 -translate-y-1/2"
            />
            <Input
              id="customer-displayName"
              name="displayName"
              autoComplete="name"
              placeholder="Tên của bạn"
              aria-required="true"
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={
                fieldErrors.displayName
                  ? "customer-displayName-error"
                  : undefined
              }
              onChange={() => clearError("displayName")}
              className="h-12 pl-12"
            />
          </div>
          {fieldError("displayName")}
        </div>
      ) : null}
      <div className="space-y-2">
        <label htmlFor="customer-phone" className="text-sm font-bold">
          Số điện thoại
        </label>
        <div className="relative">
          <Phone
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-4 size-5 -translate-y-1/2"
          />
          <Input
            id="customer-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Nhập số điện thoại của bạn"
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.phone)}
            aria-describedby={
              fieldErrors.phone ? "customer-phone-error" : undefined
            }
            onChange={() => clearError("phone")}
            className="h-12 pl-12"
          />
        </div>
        {fieldError("phone")}
      </div>
      <div className="space-y-2">
        <label htmlFor="customer-password" className="text-sm font-bold">
          Mật khẩu
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-4 size-5 -translate-y-1/2"
          />
          <Input
            id="customer-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            placeholder={
              mode === "login" ? "Nhập mật khẩu" : "Từ 10 đến 128 ký tự"
            }
            aria-required="true"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "customer-password-error" : undefined
            }
            onChange={() => clearError("password")}
            className="h-12 pr-12 pl-12"
          />
          <button
            type="button"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShowPassword((value) => !value)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
        {fieldError("password")}
      </div>
      {error ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm font-medium"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <div
          role="status"
          className="border-success/30 bg-success/10 text-foreground rounded-xl border p-4"
        >
          <p className="font-semibold">{success}</p>
          <Link
            href={authHref("/account/login")}
            className="text-primary mt-3 inline-flex min-h-11 items-center font-bold"
          >
            Đăng nhập ngay
          </Link>
        </div>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        size="lg"
        className="h-12 w-full font-bold"
      >
        {pending
          ? "Đang xử lý…"
          : mode === "login"
            ? "Đăng nhập"
            : "Tạo tài khoản"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <Link
              className="text-primary inline-flex min-h-11 items-center font-bold"
              href={authHref("/account/register")}
            >
              Đăng ký
            </Link>
          </>
        ) : (
          <>
            Đã có tài khoản hoặc cần khôi phục?{" "}
            <Link
              className="text-primary inline-flex min-h-11 items-center font-bold"
              href={authHref("/account/login")}
            >
              Đăng nhập
            </Link>
          </>
        )}
      </p>
      {mode === "login" ? (
        <p className="text-muted-foreground text-center text-xs leading-relaxed">
          Quên mật khẩu? Liên hệ hotline cửa hàng để được hỗ trợ khôi phục.
        </p>
      ) : null}
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CustomerAuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      phone: form.get("phone"),
      password: form.get("password"),
      ...(mode === "register" ? { displayName: form.get("displayName") } : {}),
    };
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
          : "Không thể tiếp tục",
      );
      setPending(false);
      return;
    }
    router.replace("/account/orders");
    router.refresh();
  }
  const inputClass =
    "border-input bg-background mt-2 h-12 w-full rounded-xl border px-3";
  return (
    <form
      onSubmit={submit}
      className="border-border mx-auto mt-8 max-w-md space-y-5 rounded-2xl border p-6"
    >
      {mode === "register" ? (
        <label className="block font-bold">
          Họ và tên
          <input
            name="displayName"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            className={inputClass}
          />
        </label>
      ) : null}
      <label className="block font-bold">
        Số điện thoại
        <input
          name="phone"
          required
          inputMode="tel"
          autoComplete="tel"
          className={inputClass}
        />
      </label>
      <label className="block font-bold">
        Mật khẩu
        <input
          name="password"
          required
          type="password"
          minLength={10}
          maxLength={128}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className={inputClass}
        />
      </label>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <button
        disabled={pending}
        className="bg-primary text-primary-foreground min-h-12 w-full rounded-xl font-bold disabled:opacity-60"
      >
        {pending
          ? "Đang xử lý…"
          : mode === "login"
            ? "Đăng nhập"
            : "Tạo tài khoản"}
      </button>
      <p className="text-center text-sm">
        {mode === "login" ? (
          <>
            Chưa có tài khoản?{" "}
            <Link className="text-primary font-bold" href="/account/register">
              Đăng ký
            </Link>
          </>
        ) : (
          <>
            Đã có tài khoản?{" "}
            <Link className="text-primary font-bold" href="/account/login">
              Đăng nhập
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

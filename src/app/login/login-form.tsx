"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface LoginFormProps {
  storeName: string;
}

export function LoginForm({ storeName }: LoginFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const displayStoreName =
    storeName || process.env.NEXT_PUBLIC_STORE_NAME || "Cửa hàng";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setPending(false);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(
        data?.message ||
          "Đăng nhập thất bại. Vui lòng kiểm tra kết nối máy chủ.",
      );
      return;
    }

    router.push("/pos");
    router.refresh();
  }

  return (
    <Card className="surface-panel w-full max-w-md border-0 p-1">
      <CardHeader className="space-y-4 p-6 pb-2 sm:p-8 sm:pb-3">
        <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-2xl lg:hidden">
          <Store aria-hidden="true" className="size-6" />
        </span>
        <div>
          <p className="eyebrow mb-2">{displayStoreName}</p>
          <CardTitle className="font-heading text-3xl font-bold">
            Chào mừng bạn trở lại
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            Nhập mật khẩu cửa hàng để bắt đầu bán hàng.
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-4 sm:p-8 sm:pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="store-password" className="text-sm font-bold">
              Mật khẩu cửa hàng
            </label>
            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="text-muted-foreground absolute top-1/2 left-4 size-5 -translate-y-1/2"
              />
              <Input
                id="store-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
                autoFocus
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                className="h-13 pr-12 pl-12 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-5" />
                ) : (
                  <Eye aria-hidden="true" className="size-5" />
                )}
              </button>
            </div>
          </div>
          {error ? (
            <p
              id="login-error"
              role="alert"
              className="bg-destructive/10 text-destructive rounded-xl px-3 py-2 text-sm font-semibold"
            >
              {error.endsWith(".") ? error : `${error}.`} Vui lòng thử lại.
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending || password.length === 0}
            className="h-13 w-full text-base"
          >
            {pending ? "Đang kiểm tra..." : "Vào bán hàng"}
          </Button>
          <div className="border-border/80 bg-muted/30 text-muted-foreground rounded-xl border border-dashed p-2.5 text-center text-xs">
            Mật khẩu mặc định hệ thống:{" "}
            <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono font-bold">
              123456
            </code>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

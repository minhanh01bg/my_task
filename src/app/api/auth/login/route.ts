import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/config/env";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifyPassword,
} from "@/server/auth/session";

const bodySchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ message: "Thiếu mật khẩu" }, { status: 400 });
  }

  const ok = await verifyPassword(
    parsed.data.password,
    env.STORE_PASSWORD_HASH,
  );

  if (!ok) {
    return NextResponse.json(
      { message: "Mật khẩu không đúng" },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await signSession({ issuedAt: Date.now() }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );
  return response;
}

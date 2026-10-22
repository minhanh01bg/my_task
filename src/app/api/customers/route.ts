import { NextResponse } from "next/server";
import { z } from "zod";

import { hasAdminSession } from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import type { CustomerOption } from "@/types/catalog";
import { normalizePhone } from "@/types/online-order";

const MAX_CUSTOMER_BODY_BYTES = 4_000;

const searchQuerySchema = z.string().trim().max(100);

export async function GET(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  const parsedQuery = searchQuerySchema.safeParse(
    new URL(request.url).searchParams.get("q") ?? "",
  );
  if (!parsedQuery.success) {
    return NextResponse.json(
      { message: "Từ khoá tìm kiếm quá dài" },
      { status: 400 },
    );
  }
  const query = parsedQuery.data;

  const customers = await prisma.customer.findMany({
    where: query ? { name: { contains: query } } : undefined,
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, phone: true },
  });

  return NextResponse.json({
    customers: customers satisfies CustomerOption[],
  });
}

const createSchema = z.object(
  {
    name: z
      .string({ error: "Thiếu tên khách" })
      .trim()
      .min(1, "Thiếu tên khách")
      .max(100, "Tên khách tối đa 100 ký tự"),
    phone: z
      .string({ error: "Số điện thoại không hợp lệ" })
      .transform(normalizePhone)
      .pipe(
        z.string().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại không hợp lệ"),
      )
      .nullable()
      .optional(),
  },
  { error: "Thiếu tên khách" },
);

export async function POST(request: Request) {
  if (!(await hasAdminSession(request))) {
    return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
  }

  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { message: "Nguồn gốc yêu cầu không hợp lệ" },
      { status: 403 },
    );
  }

  const body = await readJsonBody(request, {
    maxBytes: MAX_CUSTOMER_BODY_BYTES,
  });
  if (!body.ok) {
    return NextResponse.json(
      { message: body.message },
      { status: body.status },
    );
  }

  const parsed = createSchema.safeParse(body.data);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Thiếu tên khách" },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.create({
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null },
    select: { id: true, name: true, phone: true },
  });

  return NextResponse.json({ customer }, { status: 201 });
}

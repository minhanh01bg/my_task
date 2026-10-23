import { NextResponse } from "next/server";
import { z } from "zod";

import { logger } from "@/lib/logger";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { prisma } from "@/server/db/prisma";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import type { CustomerOption } from "@/types/catalog";
import { normalizePhone } from "@/types/online-order";

const MAX_CUSTOMER_BODY_BYTES = 4_000;
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

const searchQuerySchema = z.string().trim().max(100);

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

function unexpectedError(event: string, error: unknown) {
  const correlationId = crypto.randomUUID();
  logger.error(event, {
    correlationId,
    errorClass: error instanceof Error ? error.constructor.name : typeof error,
  });
  return privateJson(
    { message: "Lỗi hệ thống. Vui lòng thử lại.", correlationId },
    500,
  );
}

export async function GET(request: Request) {
  try {
    if (!(await hasAdminSession(request))) {
      return privateJson({ message: "Chưa đăng nhập" }, 401);
    }

    const parsedQuery = searchQuerySchema.safeParse(
      new URL(request.url).searchParams.get("q") ?? "",
    );
    if (!parsedQuery.success) {
      return privateJson({ message: "Từ khoá tìm kiếm quá dài" }, 400);
    }
    const query = parsedQuery.data;

    const customers = await prisma.customer.findMany({
      where: query ? { name: { contains: query } } : undefined,
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true, phone: true },
    });

    return privateJson({ customers: customers satisfies CustomerOption[] });
  } catch (error) {
    return unexpectedError("customer_search_failed", error);
  }
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
  try {
    if (!(await hasAdminSession(request))) {
      return privateJson({ message: "Chưa đăng nhập" }, 401);
    }

    if (!hasSafeMutationOrigin(request)) {
      return privateJson({ message: "Nguồn gốc yêu cầu không hợp lệ" }, 403);
    }

    const body = await readJsonBody(request, {
      maxBytes: MAX_CUSTOMER_BODY_BYTES,
    });
    if (!body.ok) {
      return privateJson({ message: body.message }, body.status);
    }

    const parsed = createSchema.safeParse(body.data);

    if (!parsed.success) {
      return privateJson(
        { message: parsed.error.issues[0]?.message ?? "Thiếu tên khách" },
        400,
      );
    }

    const customer = await prisma.customer.create({
      data: { name: parsed.data.name, phone: parsed.data.phone ?? null },
      select: { id: true, name: true, phone: true },
    });

    return privateJson({ customer }, 201);
  } catch (error) {
    return unexpectedError("customer_create_failed", error);
  }
}

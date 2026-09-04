import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db/prisma";
import type { CustomerOption } from "@/types/catalog";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

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

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const parsed = createSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json({ message: "Thiếu tên khách" }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: { name: parsed.data.name, phone: parsed.data.phone ?? null },
    select: { id: true, name: true, phone: true },
  });

  return NextResponse.json({ customer }, { status: 201 });
}

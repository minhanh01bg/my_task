import { NextResponse } from "next/server";

import { prisma } from "@/server/db/prisma";
import { resolveCustomerSessionToken } from "@/server/customer-auth/session";
import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import { customerNotificationMarkReadSchema } from "@/types/customer-notification";

export async function POST(request: Request) {
  if (!hasSafeMutationOrigin(request)) {
    return NextResponse.json(
      { message: "Yêu cầu không hợp lệ" },
      {
        status: 403,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const cookie = request.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)customer_session=([^;]+)/)?.[1];
  const session = await resolveCustomerSessionToken(
    cookie ? decodeURIComponent(cookie) : null,
  );

  if (!session) {
    return NextResponse.json(
      { message: "Chưa đăng nhập" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const bodyResult = await readJsonBody(request, { maxBytes: 8_000 });
  if (!bodyResult.ok) {
    return NextResponse.json(
      { message: bodyResult.message },
      {
        status: bodyResult.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const parsed = customerNotificationMarkReadSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Dữ liệu không hợp lệ" },
      {
        status: 400,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  const { notificationId } = parsed.data;

  if (notificationId) {
    await prisma.customerNotification.updateMany({
      where: {
        id: notificationId,
        accountId: session.accountId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  } else {
    await prisma.customerNotification.updateMany({
      where: {
        accountId: session.accountId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  return NextResponse.json(
    { ok: true },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

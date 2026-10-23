import { NextResponse } from "next/server";

import { hasSafeMutationOrigin } from "@/server/http/origin";
import { readJsonBody } from "@/server/http/read-json-body";
import {
  customerPasswordNeedsRehash,
  DUMMY_CUSTOMER_PASSWORD_HASH,
  hashCustomerPassword,
  verifyCustomerPassword,
} from "@/server/customer-auth/password";
import {
  checkCustomerAuthAccount,
  checkCustomerAuthPreCheck,
  checkCustomerTrustedDevice,
  resetCustomerAuthAccount,
  resetCustomerTrustedDevice,
} from "@/server/customer-auth/rate-limit";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  customerCookieOptions,
} from "@/server/customer-auth/session";
import {
  createCustomerTrustedDeviceToken,
  CUSTOMER_TRUSTED_DEVICE_COOKIE,
  customerTrustedDeviceCookieOptions,
  resolveCustomerTrustedDevice,
} from "@/server/customer-auth/trusted-device";
import { prisma } from "@/server/db/prisma";
import { customerLoginSchema } from "@/types/customer-auth";

const GENERIC_ERROR = { message: "Số điện thoại hoặc mật khẩu không đúng" };

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

  // Layer 1: Streamed body cap (16 KB)
  const bodyResult = await readJsonBody(request, { maxBytes: 16_000 });
  if (!bodyResult.ok) {
    return NextResponse.json(
      { message: bodyResult.message },
      {
        status: bodyResult.status,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }

  // Layer 2: Pre-parse IP, subnet, and global rate limit check
  const preCheck = await checkCustomerAuthPreCheck(request);
  if (!preCheck.ok) {
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (preCheck.retryAfterSeconds) {
      headers["Retry-After"] = String(preCheck.retryAfterSeconds);
    }
    return NextResponse.json(
      { message: preCheck.message },
      { status: preCheck.status, headers },
    );
  }

  // Layer 3: Validate input schema
  const parsed = customerLoginSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(GENERIC_ERROR, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const account = await prisma.customerAccount.findUnique({
    where: { phoneNormalized: parsed.data.phone },
    select: {
      id: true,
      displayName: true,
      passwordHash: true,
      disabledAt: true,
    },
  });

  const usableAccount = account && !account.disabledAt ? account : null;

  // Layer 4: Velocity check on normalized phone number (cleared on success).
  // A device that logged in to this account before uses its own bucket.
  const trustedDeviceId = usableAccount
    ? resolveCustomerTrustedDevice(
        request,
        usableAccount.id,
        usableAccount.passwordHash,
      )
    : null;
  const accountCheck = trustedDeviceId
    ? await checkCustomerTrustedDevice(trustedDeviceId)
    : await checkCustomerAuthAccount(parsed.data.phone);
  if (!accountCheck.ok) {
    const headers: Record<string, string> = {
      "Cache-Control": "private, no-store",
    };
    if (accountCheck.retryAfterSeconds) {
      headers["Retry-After"] = String(accountCheck.retryAfterSeconds);
    }
    return NextResponse.json(
      { message: accountCheck.message },
      { status: accountCheck.status, headers },
    );
  }

  // Always run exactly one scrypt verification, against a dummy hash when
  // there is no usable account, so timing does not reveal which phones exist.
  const passwordMatches = await verifyCustomerPassword(
    parsed.data.password,
    usableAccount?.passwordHash ?? DUMMY_CUSTOMER_PASSWORD_HASH,
  );

  if (!usableAccount || !passwordMatches) {
    return NextResponse.json(GENERIC_ERROR, {
      status: 401,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  // Reset the account-level failure counter on successful login
  await resetCustomerAuthAccount(parsed.data.phone);
  if (trustedDeviceId) await resetCustomerTrustedDevice(trustedDeviceId);

  // Upgrade hashes made with older scrypt parameters while the password is
  // known; the hash in `where` keeps a concurrent password change intact.
  let passwordHash = usableAccount.passwordHash;
  if (customerPasswordNeedsRehash(passwordHash)) {
    const rehashed = await hashCustomerPassword(parsed.data.password);
    const { count } = await prisma.customerAccount.updateMany({
      where: { id: usableAccount.id, passwordHash },
      data: { passwordHash: rehashed },
    });
    if (count === 1) passwordHash = rehashed;
  }

  const session = await createCustomerSession(usableAccount.id);
  const response = NextResponse.json(
    { data: { account: { displayName: usableAccount.displayName } } },
    {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.url.startsWith("https:");

  // HTTPS can only add Secure; it never relaxes the production default.
  const secure = customerCookieOptions.secure || isHttps;
  response.cookies.set(CUSTOMER_SESSION_COOKIE, session.token, {
    ...customerCookieOptions,
    secure,
  });
  // Bound to the hash stored after the upgrade above, so it survives it.
  const deviceToken = createCustomerTrustedDeviceToken(
    usableAccount.id,
    passwordHash,
  );
  if (deviceToken) {
    response.cookies.set(
      CUSTOMER_TRUSTED_DEVICE_COOKIE,
      deviceToken,
      customerTrustedDeviceCookieOptions(secure),
    );
  }
  return response;
}

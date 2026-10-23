import { readCookie } from "@/server/auth/require-admin-session";
import {
  createTrustedDeviceToken,
  TRUSTED_DEVICE_MAX_AGE_SECONDS,
  verifyTrustedDeviceToken,
} from "@/server/auth/trusted-device";
import { customerCookieOptions } from "@/server/customer-auth/session";

/**
 * Customer counterpart of the admin trusted-device cookie: a device that logged
 * in to an account skips that account's per-phone failure bucket, which anyone
 * who knows the phone number could otherwise keep exhausted.
 */
export const CUSTOMER_TRUSTED_DEVICE_COOKIE = "customer_trusted_device";
const CUSTOMER_TRUSTED_DEVICE_LABEL = "customer-login";

/** Bound to the account id, so a re-registered phone starts untrusted. */
export function createCustomerTrustedDeviceToken(
  accountId: string,
  now?: number,
): string | null {
  return createTrustedDeviceToken(
    CUSTOMER_TRUSTED_DEVICE_LABEL,
    accountId,
    now,
  );
}

/** Device id from the request's device cookie, if valid for this account. */
export function resolveCustomerTrustedDevice(
  request: Request,
  accountId: string,
): string | null {
  return verifyTrustedDeviceToken(
    CUSTOMER_TRUSTED_DEVICE_LABEL,
    readCookie(request.headers.get("cookie"), CUSTOMER_TRUSTED_DEVICE_COOKIE),
    accountId,
  );
}

/** Sent only to the login endpoint, the one place that reads it. */
export function customerTrustedDeviceCookieOptions(secure: boolean) {
  return {
    ...customerCookieOptions,
    secure,
    path: "/api/customer-auth/login",
    maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
  };
}

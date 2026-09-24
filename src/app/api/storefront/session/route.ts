import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import type { StorefrontSession } from "@/types/storefront";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };

/**
 * Trạng thái phiên cho header storefront (client island). HTML trang `/shop`
 * không đọc cookie nữa nên được cache; phần phụ thuộc phiên lấy ở đây.
 */
export async function GET() {
  let body: StorefrontSession;
  try {
    const [isAdmin, customerSession] = await Promise.all([
      hasAdminSession(),
      getOptionalCustomerSession(),
    ]);
    body = { isAdmin, isCustomer: Boolean(customerSession) };
  } catch (error) {
    logger.error("storefront_session_resolve_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    body = { isAdmin: false, isCustomer: false };
  }

  return NextResponse.json<StorefrontSession>(body, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}

import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { sanitizeCspReport } from "@/server/security/csp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const sanitized = sanitizeCspReport(rawBody);

    logger.warn("CSP Violation reported", {
      category: "csp.violation",
      directive: sanitized["violated-directive"],
      blockedUri: sanitized["blocked-uri"],
      documentUri: sanitized["document-uri"],
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { sanitizeCspReport } from "@/server/security/csp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const sanitized = sanitizeCspReport(rawBody);

    const disposition = sanitized["disposition"] as string | undefined;
    const isEnforce =
      disposition === "enforce" ||
      (!disposition && process.env.CSP_MODE === "enforce");

    const payload = {
      category: "csp.violation",
      directive:
        (sanitized["violated-directive"] as string | undefined) ||
        (sanitized["effective-directive"] as string | undefined),
      blockedUri: sanitized["blocked-uri"] as string | undefined,
      documentUri: sanitized["document-uri"] as string | undefined,
      disposition: disposition || (isEnforce ? "enforce" : "report"),
    };

    if (isEnforce) {
      logger.warn("CSP Violation reported", payload);
    } else {
      logger.info("CSP Violation reported", payload);
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}

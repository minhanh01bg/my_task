import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { readJsonBody } from "@/server/http/read-json-body";
import { extractCspReports } from "@/server/security/csp";
import { checkCspReportRateLimit } from "@/server/security/csp-report-rate-limit";

export const dynamic = "force-dynamic";

// A real violation report is a few hundred bytes; a batch of a few fits easily.
const MAX_REPORT_BYTES = 16_384;
const REPORT_CONTENT_TYPES = [
  "application/csp-report",
  "application/reports+json",
  "application/json",
];

export async function POST(request: Request) {
  // Checked before reading the body; over the limit nothing is logged.
  const retryAfterSeconds = await checkCspReportRateLimit(request);
  if (retryAfterSeconds !== null) {
    return new NextResponse(null, {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    });
  }

  const body = await readJsonBody(request, {
    maxBytes: MAX_REPORT_BYTES,
    allowedContentTypes: REPORT_CONTENT_TYPES,
  });
  if (!body.ok) {
    return new NextResponse(null, { status: body.status });
  }

  for (const report of extractCspReports(body.data)) {
    const disposition = report["disposition"] as string | undefined;
    const isEnforce =
      disposition === "enforce" ||
      (!disposition && process.env.CSP_MODE === "enforce");

    const payload = {
      category: "csp.violation",
      directive:
        (report["violated-directive"] as string | undefined) ||
        (report["effective-directive"] as string | undefined),
      blockedUri: report["blocked-uri"] as string | undefined,
      documentUri: report["document-uri"] as string | undefined,
      disposition: disposition || (isEnforce ? "enforce" : "report"),
      statusCode: report["status-code"] as number | undefined,
      sourceFile: report["source-file"] as string | undefined,
      lineNumber: report["line-number"] as number | undefined,
      columnNumber: report["column-number"] as number | undefined,
    };

    if (isEnforce) {
      logger.warn("CSP Violation reported", payload);
    } else {
      logger.info("CSP Violation reported", payload);
    }
  }

  return new NextResponse(null, { status: 204 });
}

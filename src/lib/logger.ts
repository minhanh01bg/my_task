import { normalizeSafePath, redactLogData } from "./log-redaction";

type LogLevel = "info" | "warn" | "error";

function formatMessage(level: LogLevel, message: string, meta?: unknown) {
  const timestamp = new Date().toISOString();
  return {
    timestamp,
    level,
    message: normalizeSafePath(message),
    meta: meta !== undefined ? redactLogData(meta) : undefined,
  };
}

/**
 * Truong log an toan cho mot loi: ten lop va ma (vd. Prisma `P2002`), khong
 * kem `message` — thong diep Prisma co the lap lai SDT/ten khach.
 */
export function errorLogFields(error: unknown): {
  errorClass: string;
  errorCode?: string;
} {
  const errorClass =
    error instanceof Error ? error.constructor.name : typeof error;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
  return typeof code === "string" || typeof code === "number"
    ? { errorClass, errorCode: String(code) }
    : { errorClass };
}

export const logger = {
  info(message: string, meta?: unknown) {
    console.info(formatMessage("info", message, meta));
  },
  warn(message: string, meta?: unknown) {
    console.warn(formatMessage("warn", message, meta));
  },
  error(message: string, meta?: unknown) {
    console.error(formatMessage("error", message, meta));
  },
};

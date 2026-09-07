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

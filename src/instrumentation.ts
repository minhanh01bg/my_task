import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Ap pragma SQLite (WAL, busy_timeout...) mot lan luc boot.
    await import("@/server/db/prisma").then((m) => m.prismaReady);

    // Tren Windows/dev, cache file cua libvips gay canh bao khi hot-reload.
    // Production giu cache de next/image resize nhanh hon.
    if (process.env.NODE_ENV !== "production" || process.platform === "win32") {
      try {
        const sharp = (await import("sharp")).default;
        sharp.cache(false);
      } catch {
        // sharp might not be loaded in all runtime contexts
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  await Sentry.captureRequestError(...args);
};

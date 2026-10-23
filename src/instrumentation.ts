import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");

    // Ap pragma SQLite (WAL, busy_timeout...) mot lan luc boot.
    await import("@/server/db/prisma").then((m) => m.prismaReady);

    // Tu huy don online chua thanh toan qua 24h de tra ton kho bi giu, va tinh
    // lai diem san pham chi tu danh gia da mua (mot lan, sau boot).
    // Khong hen gio khi `next build` hay khi chay test.
    if (
      process.env.NEXT_PHASE !== "phase-production-build" &&
      process.env.NODE_ENV !== "test" &&
      !process.env.VITEST
    ) {
      const { scheduleStaleOnlineOrderExpiry } =
        await import("@/server/orders/expire-stale-online-orders");
      scheduleStaleOnlineOrderExpiry();
      const { scheduleVerifiedRatingBackfill } =
        await import("@/server/reviews/backfill-verified-ratings");
      scheduleVerifiedRatingBackfill();
    }

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

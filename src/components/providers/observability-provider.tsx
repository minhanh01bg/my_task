import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/**
 * Chỉ bật khi chạy trên Vercel: ngoài Vercel hai script này gọi endpoint
 * `/_vercel/*` không tồn tại (404). Server Component để đọc được `VERCEL`
 * (không có tiền tố NEXT_PUBLIC_) mà không lệch khi hydrate; hai component
 * con đã tự là client component.
 */
export function ObservabilityProvider() {
  const isVercel = Boolean(
    process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL,
  );
  if (!isVercel) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

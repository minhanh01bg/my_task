import type { Metadata } from "next";

import { ServiceWorkerRegistrar } from "@/components/pos/service-worker-registrar";
import { QueryProvider } from "@/providers/query-provider";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};

/** Service worker (offline shell `/pos`) và React Query chỉ cần cho khu vực bán hàng. */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <ServiceWorkerRegistrar />
    </QueryProvider>
  );
}

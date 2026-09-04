import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { ObservabilityProvider } from "@/components/providers/observability-provider";
import { ServiceWorkerRegistrar } from "@/components/pos/service-worker-registrar";
import { Providers } from "@/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="bg-background text-foreground min-h-full">
        <Providers>{children}</Providers>
        <ObservabilityProvider />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";

import { siteConfig } from "@/config/site";
import { ObservabilityProvider } from "@/components/providers/observability-provider";
import { ServiceWorkerRegistrar } from "@/components/pos/service-worker-registrar";
import { Providers } from "@/providers";

import "./globals.css";

const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin", "vietnamese"],
});
const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="vi"
      suppressHydrationWarning
      className={`h-full antialiased ${sans.variable} ${mono.variable}`}
    >
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
        <ObservabilityProvider />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
